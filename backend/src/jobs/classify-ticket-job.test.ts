import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../db.js';
import { classifyTicket } from '../ai/classify-ticket.js';
import { boss } from './boss.js';
import {
  classifyTicketInBackground,
  registerClassifyTicketWorker,
  CLASSIFY_TICKET_QUEUE,
} from './classify-ticket-job.js';
import { TicketCategory } from '../generated/prisma/enums.js';

vi.mock('../db.js', () => ({
  prisma: { ticket: { update: vi.fn() } },
}));

vi.mock('../ai/classify-ticket.js', () => ({
  classifyTicket: vi.fn(),
}));

vi.mock('./boss.js', () => ({
  boss: { send: vi.fn(), createQueue: vi.fn(), work: vi.fn() },
}));

const mockedUpdate = vi.mocked(prisma.ticket.update);
const mockedClassifyTicket = vi.mocked(classifyTicket);
const mockedSend = vi.mocked(boss.send);
const mockedCreateQueue = vi.mocked(boss.createQueue);
const mockedWork = vi.mocked(boss.work);

beforeEach(() => {
  mockedUpdate.mockReset();
  mockedClassifyTicket.mockReset();
  mockedSend.mockReset();
  mockedCreateQueue.mockReset();
  mockedWork.mockReset();
});

describe('classifyTicketInBackground', () => {
  it('enqueues a classification job with the ticket id, subject, and message body', () => {
    mockedSend.mockResolvedValue('job-1');

    classifyTicketInBackground(
      { id: 'ticket-1', subject: 'Refund request' } as never,
      { body: 'I want my money back' } as never
    );

    expect(mockedSend).toHaveBeenCalledWith(CLASSIFY_TICKET_QUEUE, {
      ticketId: 'ticket-1',
      subject: 'Refund request',
      body: 'I want my money back',
    });
  });

  it('logs and does not throw when enqueueing fails', async () => {
    mockedSend.mockRejectedValue(new Error('upstream failure'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    classifyTicketInBackground(
      { id: 'ticket-1', subject: 'Refund request' } as never,
      { body: 'I want my money back' } as never
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to enqueue classification for ticket ticket-1',
      expect.any(Error)
    );
    consoleError.mockRestore();
  });
});

describe('registerClassifyTicketWorker', () => {
  it('creates the queue with retry options and registers a worker that classifies and updates the ticket', async () => {
    mockedCreateQueue.mockResolvedValue(undefined);
    mockedClassifyTicket.mockResolvedValue(TicketCategory.refundRequest);
    mockedUpdate.mockResolvedValue({} as never);
    mockedWork.mockImplementation(async (_name, handler) => {
      await (handler as (jobs: unknown[]) => Promise<unknown>)([
        { data: { ticketId: 'ticket-1', subject: 'Refund request', body: 'I want my money back' } },
      ]);
      return 'worker-1';
    });

    await registerClassifyTicketWorker();

    expect(mockedCreateQueue).toHaveBeenCalledWith(CLASSIFY_TICKET_QUEUE, { retryLimit: 3, retryBackoff: true });
    expect(mockedClassifyTicket).toHaveBeenCalledWith('Refund request', 'I want my money back');
    expect(mockedUpdate).toHaveBeenCalledWith({
      where: { id: 'ticket-1' },
      data: { category: TicketCategory.refundRequest },
    });
  });
});
