import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { prisma } from '../db.js';
import { summarizeTicket } from '../ai/summarize-ticket.js';

vi.mock('../db.js', () => ({
  prisma: {
    ticket: { findUnique: vi.fn() },
  },
}));

vi.mock('../ai/summarize-ticket.js', () => ({
  summarizeTicket: vi.fn(),
}));

vi.mock('../middleware/require-auth.js', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 'agent-1', name: 'Alice Agent' } as express.Request['user'];
    next();
  },
}));

const mockedFindUnique = vi.mocked(prisma.ticket.findUnique);
const mockedSummarizeTicket = vi.mocked(summarizeTicket);

async function buildApp() {
  const { ticketsRouter } = await import('./tickets.js');
  const app = express();
  app.use(express.json());
  app.use('/api/tickets', ticketsRouter);
  return app;
}

beforeEach(() => {
  mockedFindUnique.mockReset();
  mockedSummarizeTicket.mockReset();
});

describe('POST /api/tickets/:id/summary', () => {
  it('summarizes the ticket subject with messages and replies merged in chronological order', async () => {
    mockedFindUnique.mockResolvedValue({
      subject: 'Refund request',
      requesterName: 'Rae Requester',
      requesterEmail: 'rae@test.com',
      messages: [
        {
          fromName: 'Rae Requester',
          fromEmail: 'rae@test.com',
          body: 'I want a refund',
          createdAt: new Date('2026-01-10T00:00:00.000Z'),
        },
      ],
      replies: [
        {
          body: 'Sure, processing it now',
          createdAt: new Date('2026-01-11T00:00:00.000Z'),
          senderType: 'agent',
          author: { name: 'Alice Agent' },
        },
      ],
    } as never);
    mockedSummarizeTicket.mockResolvedValue('Customer requested a refund; agent is processing it.');
    const app = await buildApp();

    const res = await request(app).post('/api/tickets/ticket-1/summary');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ summary: 'Customer requested a refund; agent is processing it.' });
    expect(mockedSummarizeTicket).toHaveBeenCalledWith('Refund request', [
      { from: 'Rae Requester', body: 'I want a refund', createdAt: new Date('2026-01-10T00:00:00.000Z') },
      {
        from: 'Alice Agent',
        body: 'Sure, processing it now',
        createdAt: new Date('2026-01-11T00:00:00.000Z'),
      },
    ]);
  });

  it('falls back to a generic label when a reply has no author', async () => {
    mockedFindUnique.mockResolvedValue({
      subject: 'Refund request',
      requesterName: null,
      requesterEmail: 'rae@test.com',
      messages: [],
      replies: [
        {
          body: 'Thanks for reaching out',
          createdAt: new Date('2026-01-11T00:00:00.000Z'),
          senderType: 'auto',
          author: null,
        },
      ],
    } as never);
    mockedSummarizeTicket.mockResolvedValue('summary');
    const app = await buildApp();

    await request(app).post('/api/tickets/ticket-1/summary');

    expect(mockedSummarizeTicket).toHaveBeenCalledWith('Refund request', [
      { from: 'Customer', body: 'Thanks for reaching out', createdAt: new Date('2026-01-11T00:00:00.000Z') },
    ]);
  });

  it('returns 400 when the ticket has no messages or replies', async () => {
    mockedFindUnique.mockResolvedValue({
      subject: 'Refund request',
      requesterName: null,
      requesterEmail: 'rae@test.com',
      messages: [],
      replies: [],
    } as never);
    const app = await buildApp();

    const res = await request(app).post('/api/tickets/ticket-1/summary');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Ticket has no messages to summarize' });
    expect(mockedSummarizeTicket).not.toHaveBeenCalled();
  });

  it('returns 404 when the ticket does not exist', async () => {
    mockedFindUnique.mockResolvedValue(null);
    const app = await buildApp();

    const res = await request(app).post('/api/tickets/missing-ticket/summary');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Ticket not found' });
    expect(mockedSummarizeTicket).not.toHaveBeenCalled();
  });

  it('returns 502 when the AI call fails', async () => {
    mockedFindUnique.mockResolvedValue({
      subject: 'Refund request',
      requesterName: null,
      requesterEmail: 'rae@test.com',
      messages: [
        {
          fromName: 'Rae Requester',
          fromEmail: 'rae@test.com',
          body: 'I want a refund',
          createdAt: new Date('2026-01-10T00:00:00.000Z'),
        },
      ],
      replies: [],
    } as never);
    mockedSummarizeTicket.mockRejectedValue(new Error('upstream failure'));
    const app = await buildApp();

    const res = await request(app).post('/api/tickets/ticket-1/summary');

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Failed to summarize ticket' });
  });
});
