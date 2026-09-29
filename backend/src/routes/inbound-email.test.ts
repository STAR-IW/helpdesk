import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { prisma } from '../db.js';
import { processTicketInBackground, followUpTicketInBackground } from '../jobs/process-ticket-job.js';
import { TicketStatus } from '../generated/prisma/enums.js';

vi.mock('../db.js', () => ({
  prisma: {
    ticket: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../jobs/process-ticket-job.js', () => ({
  processTicketInBackground: vi.fn(),
  followUpTicketInBackground: vi.fn(),
}));

vi.mock('../middleware/require-webhook-secret.js', () => ({
  requireWebhookSecret: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

const mockedFindMany = vi.mocked(prisma.ticket.findMany);
const mockedCreate = vi.mocked(prisma.ticket.create);
const mockedUpdate = vi.mocked(prisma.ticket.update);
const mockedProcessTicketInBackground = vi.mocked(processTicketInBackground);
const mockedFollowUpTicketInBackground = vi.mocked(followUpTicketInBackground);

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
  mockedProcessTicketInBackground.mockReset();
  mockedFollowUpTicketInBackground.mockReset();
});

describe('POST /api/inbound-email', () => {
  it('queues AI processing for a newly created ticket with its first message', async () => {
    mockedFindMany.mockResolvedValue([]);
    const createdTicket = {
      id: 'ticket-1',
      subject: 'Refund request',
      messages: [{ body: 'I want my money back' }],
    };
    mockedCreate.mockResolvedValue(createdTicket as never);
    const app = await buildApp();

    const res = await request(app).post('/api/inbound-email').send(payload);

    expect(res.status).toBe(201);
    expect(mockedProcessTicketInBackground).toHaveBeenCalledWith(createdTicket, createdTicket.messages[0]);
    expect(mockedFollowUpTicketInBackground).not.toHaveBeenCalled();
  });

  it('queues nothing when the message is appended to an existing open ticket', async () => {
    mockedFindMany.mockResolvedValue([
      { id: 'ticket-1', subject: 'Refund request', status: TicketStatus.open },
    ] as never);
    mockedUpdate.mockResolvedValueOnce({ id: 'ticket-1', messages: [] } as never);
    const app = await buildApp();

    const res = await request(app).post('/api/inbound-email').send(payload);

    expect(res.status).toBe(201);
    expect(mockedProcessTicketInBackground).not.toHaveBeenCalled();
    expect(mockedFollowUpTicketInBackground).not.toHaveBeenCalled();
  });

  it('queues a follow-up check when the message is appended to a resolved ticket', async () => {
    mockedFindMany.mockResolvedValue([
      { id: 'ticket-1', subject: 'Refund request', status: TicketStatus.resolved },
    ] as never);
    mockedUpdate.mockResolvedValueOnce({ id: 'ticket-1', messages: [] } as never);
    const app = await buildApp();

    const res = await request(app).post('/api/inbound-email').send({ ...payload, subject: 'Re: Refund request' });

    expect(res.status).toBe(201);
    expect(mockedProcessTicketInBackground).not.toHaveBeenCalled();
    expect(mockedFollowUpTicketInBackground).toHaveBeenCalledWith('ticket-1', 'I want my money back');
  });
});
