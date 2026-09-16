import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { prisma } from '../db.js';
import { classifyTicket } from '../ai/classify-ticket.js';
import { TicketCategory } from '../generated/prisma/enums.js';

vi.mock('../db.js', () => ({
  prisma: {
    ticket: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../ai/classify-ticket.js', () => ({
  classifyTicket: vi.fn(),
}));

vi.mock('../middleware/require-webhook-secret.js', () => ({
  requireWebhookSecret: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

const mockedFindMany = vi.mocked(prisma.ticket.findMany);
const mockedCreate = vi.mocked(prisma.ticket.create);
const mockedUpdate = vi.mocked(prisma.ticket.update);
const mockedClassifyTicket = vi.mocked(classifyTicket);

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
  mockedClassifyTicket.mockReset();
});

describe('POST /api/inbound-email', () => {
  it('responds before the classification call resolves, then writes the category once it does', async () => {
    mockedFindMany.mockResolvedValue([]);
    mockedCreate.mockResolvedValue({
      id: 'ticket-1',
      subject: 'Refund request',
      messages: [{ body: 'I want my money back' }],
    } as never);
    let resolveClassification: (category: TicketCategory) => void;
    mockedClassifyTicket.mockReturnValue(
      new Promise((resolve) => {
        resolveClassification = resolve;
      })
    );
    mockedUpdate.mockResolvedValue({} as never);
    const app = await buildApp();

    const res = await request(app).post('/api/inbound-email').send(payload);

    expect(res.status).toBe(201);
    expect(mockedClassifyTicket).toHaveBeenCalledWith('Refund request', 'I want my money back');
    expect(mockedUpdate).not.toHaveBeenCalled();

    resolveClassification!(TicketCategory.refundRequest);
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket-1' },
      data: { category: TicketCategory.refundRequest },
    });
  });

  it('does not classify when the message is appended to an existing open ticket', async () => {
    mockedFindMany.mockResolvedValue([{ id: 'ticket-1', subject: 'Refund request' }] as never);
    mockedUpdate.mockResolvedValueOnce({ id: 'ticket-1', messages: [] } as never);
    const app = await buildApp();

    const res = await request(app).post('/api/inbound-email').send(payload);

    expect(res.status).toBe(201);
    expect(mockedClassifyTicket).not.toHaveBeenCalled();
  });

  it('logs and does not crash when classification fails', async () => {
    mockedFindMany.mockResolvedValue([]);
    mockedCreate.mockResolvedValue({
      id: 'ticket-1',
      subject: 'Refund request',
      messages: [{ body: 'I want my money back' }],
    } as never);
    mockedClassifyTicket.mockRejectedValue(new Error('upstream failure'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = await buildApp();

    const res = await request(app).post('/api/inbound-email').send(payload);
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.status).toBe(201);
    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith('Failed to classify ticket ticket-1', expect.any(Error));
    consoleError.mockRestore();
  });
});
