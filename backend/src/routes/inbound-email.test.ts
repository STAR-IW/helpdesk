import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { prisma } from '../db.js';
import { enqueueProcessTicket, enqueueFollowUpTicket } from '../jobs/process-ticket-job.js';
import { TicketStatus } from '../generated/prisma/enums.js';

const tx = vi.hoisted(() => ({
  ticket: { create: vi.fn(), update: vi.fn() },
}));

vi.mock('../db.js', () => ({
  prisma: {
    ticket: { findMany: vi.fn() },
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  },
}));

vi.mock('../ai-agent.js', () => ({
  getAiAgentIdIfSeeded: vi.fn().mockResolvedValue(null),
}));

vi.mock('../jobs/process-ticket-job.js', () => ({
  enqueueProcessTicket: vi.fn(),
  enqueueFollowUpTicket: vi.fn(),
}));

vi.mock('../middleware/require-webhook-secret.js', () => ({
  requireWebhookSecret: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

const mockedFindMany = vi.mocked(prisma.ticket.findMany);
const mockedCreate = tx.ticket.create;
const mockedUpdate = tx.ticket.update;
const mockedEnqueueProcessTicket = vi.mocked(enqueueProcessTicket);
const mockedEnqueueFollowUpTicket = vi.mocked(enqueueFollowUpTicket);

async function buildApp() {
  const { inboundEmailRouter } = await import('./inbound-email.js');
  const app = express();
  app.use(express.json());
  app.use('/api/inbound-email', inboundEmailRouter);
  return app;
}

const payload = {
  from: 'rae@test.com',
  fromName: 'Rae Requester',
  to: 'support@test.com',
  subject: 'Refund request',
  text: 'I want my money back',
};

beforeEach(() => {
  mockedFindMany.mockReset();
  mockedCreate.mockReset();
  mockedUpdate.mockReset();
  mockedEnqueueProcessTicket.mockReset().mockResolvedValue(undefined);
  mockedEnqueueFollowUpTicket.mockReset().mockResolvedValue(undefined);
});

describe('POST /api/inbound-email', () => {
  it('queues AI processing for a newly created ticket in the same transaction', async () => {
    mockedFindMany.mockResolvedValue([]);
    const createdTicket = {
      id: 'ticket-1',
      subject: 'Refund request',
      messages: [{ body: 'I want my money back' }],
    };
    mockedCreate.mockResolvedValue(createdTicket);
    const app = await buildApp();

    const res = await request(app).post('/api/inbound-email').send(payload);

    expect(res.status).toBe(201);
    expect(mockedEnqueueProcessTicket).toHaveBeenCalledWith(tx, createdTicket, createdTicket.messages[0]);
    expect(mockedEnqueueFollowUpTicket).not.toHaveBeenCalled();
  });

  it('returns 500 when enqueueing the new ticket fails, so the transaction rolls back', async () => {
    mockedFindMany.mockResolvedValue([]);
    mockedCreate.mockResolvedValue({ id: 'ticket-1', messages: [{ body: 'I want my money back' }] });
    mockedEnqueueProcessTicket.mockRejectedValue(new Error('queue down'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = await buildApp();

    const res = await request(app).post('/api/inbound-email').send(payload);

    expect(res.status).toBe(500);
    consoleError.mockRestore();
  });

  it('queues nothing when the message is appended to an existing open ticket', async () => {
    mockedFindMany.mockResolvedValue([
      { id: 'ticket-1', subject: 'Refund request', status: TicketStatus.open },
    ] as never);
    mockedUpdate.mockResolvedValueOnce({ id: 'ticket-1', messages: [] });
    const app = await buildApp();

    const res = await request(app).post('/api/inbound-email').send(payload);

    expect(res.status).toBe(201);
    expect(mockedEnqueueProcessTicket).not.toHaveBeenCalled();
    expect(mockedEnqueueFollowUpTicket).not.toHaveBeenCalled();
  });

  it('queues a follow-up check in the same transaction when the message is appended to a resolved ticket', async () => {
    mockedFindMany.mockResolvedValue([
      { id: 'ticket-1', subject: 'Refund request', status: TicketStatus.resolved },
    ] as never);
    mockedUpdate.mockResolvedValueOnce({ id: 'ticket-1', messages: [] });
    const app = await buildApp();

    const res = await request(app).post('/api/inbound-email').send({ ...payload, subject: 'Re: Refund request' });

    expect(res.status).toBe(201);
    expect(mockedEnqueueProcessTicket).not.toHaveBeenCalled();
    expect(mockedEnqueueFollowUpTicket).toHaveBeenCalledWith(tx, 'ticket-1', 'I want my money back');
  });
});
