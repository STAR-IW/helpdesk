import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { prisma } from '../db.js';
import { polishReply } from '../ai/polish-reply.js';

vi.mock('../db.js', () => ({
  prisma: {
    ticket: { findUnique: vi.fn() },
  },
}));

vi.mock('../ai/polish-reply.js', () => ({
  polishReply: vi.fn(),
}));

vi.mock('../middleware/require-auth.js', () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { id: 'agent-1', name: 'Alice Agent' } as express.Request['user'];
    next();
  },
}));

const mockedFindUnique = vi.mocked(prisma.ticket.findUnique);
const mockedPolishReply = vi.mocked(polishReply);

async function buildApp() {
  const { ticketsRouter } = await import('./tickets.js');
  const app = express();
  app.use(express.json());
  app.use('/api/tickets', ticketsRouter);
  return app;
}

beforeEach(() => {
  mockedFindUnique.mockReset();
  mockedPolishReply.mockReset();
});

describe('POST /api/tickets/:id/replies/polish', () => {
  it('polishes the draft using the ticket subject, agent name, and customer first name', async () => {
    mockedFindUnique.mockResolvedValue({ subject: 'Refund request', requesterName: 'Rae Requester' } as never);
    mockedPolishReply.mockResolvedValue('Hi Rae, we are on it. — Alice Agent');
    const app = await buildApp();

    const res = await request(app)
      .post('/api/tickets/ticket-1/replies/polish')
      .send({ body: 'we on it' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ text: 'Hi Rae, we are on it. — Alice Agent' });
    expect(mockedPolishReply).toHaveBeenCalledWith('we on it', 'Refund request', 'Alice Agent', 'Rae');
  });

  it('passes null as the customer first name when the ticket has no requester name', async () => {
    mockedFindUnique.mockResolvedValue({ subject: 'Refund request', requesterName: null } as never);
    mockedPolishReply.mockResolvedValue('polished');
    const app = await buildApp();

    await request(app).post('/api/tickets/ticket-1/replies/polish').send({ body: 'we on it' });

    expect(mockedPolishReply).toHaveBeenCalledWith('we on it', 'Refund request', 'Alice Agent', null);
  });

  it('returns 400 when body is missing', async () => {
    const app = await buildApp();

    const res = await request(app).post('/api/tickets/ticket-1/replies/polish').send({});

    expect(res.status).toBe(400);
    expect(mockedFindUnique).not.toHaveBeenCalled();
    expect(mockedPolishReply).not.toHaveBeenCalled();
  });

  it('returns 400 when body is empty/whitespace-only', async () => {
    const app = await buildApp();

    const res = await request(app)
      .post('/api/tickets/ticket-1/replies/polish')
      .send({ body: '   ' });

    expect(res.status).toBe(400);
    expect(mockedPolishReply).not.toHaveBeenCalled();
  });

  it('returns 404 when the ticket does not exist', async () => {
    mockedFindUnique.mockResolvedValue(null);
    const app = await buildApp();

    const res = await request(app)
      .post('/api/tickets/missing-ticket/replies/polish')
      .send({ body: 'we on it' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Ticket not found' });
    expect(mockedPolishReply).not.toHaveBeenCalled();
  });

  it('returns 502 when the AI call fails', async () => {
    mockedFindUnique.mockResolvedValue({ subject: 'Refund request', requesterName: 'Rae Requester' } as never);
    mockedPolishReply.mockRejectedValue(new Error('upstream failure'));
    const app = await buildApp();

    const res = await request(app)
      .post('/api/tickets/ticket-1/replies/polish')
      .send({ body: 'we on it' });

    expect(res.status).toBe(502);
    expect(res.body).toEqual({ error: 'Failed to polish reply' });
  });
});
