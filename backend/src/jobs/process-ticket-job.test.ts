import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../db.js';
import { classifyTicket } from '../ai/classify-ticket.js';
import { autoResolveTicket } from '../ai/auto-resolve-ticket.js';
import { isAcknowledgementOnly } from '../ai/is-acknowledgement.js';
import { boss } from './boss.js';
import {
  processTicketInBackground,
  followUpTicketInBackground,
  registerTicketWorkers,
  PROCESS_TICKET_QUEUE,
  FOLLOW_UP_TICKET_QUEUE,
} from './process-ticket-job.js';
import { SenderType, TicketCategory, TicketStatus } from '../generated/prisma/enums.js';

vi.mock('../db.js', () => ({
  prisma: {
    ticket: { update: vi.fn(), updateMany: vi.fn() },
    reply: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../ai/classify-ticket.js', () => ({
  classifyTicket: vi.fn(),
}));

vi.mock('../ai/auto-resolve-ticket.js', () => ({
  autoResolveTicket: vi.fn(),
}));

vi.mock('../ai/is-acknowledgement.js', () => ({
  isAcknowledgementOnly: vi.fn(),
}));

vi.mock('./boss.js', () => ({
  boss: { send: vi.fn(), createQueue: vi.fn(), work: vi.fn() },
}));

const mockedUpdate = vi.mocked(prisma.ticket.update);
const mockedUpdateMany = vi.mocked(prisma.ticket.updateMany);
const mockedReplyCreate = vi.mocked(prisma.reply.create);
const mockedTransaction = vi.mocked(prisma.$transaction);
const mockedClassifyTicket = vi.mocked(classifyTicket);
const mockedAutoResolveTicket = vi.mocked(autoResolveTicket);
const mockedIsAcknowledgementOnly = vi.mocked(isAcknowledgementOnly);
const mockedSend = vi.mocked(boss.send);
const mockedCreateQueue = vi.mocked(boss.createQueue);
const mockedWork = vi.mocked(boss.work);

type Handler = (jobs: unknown[]) => Promise<unknown>;

// Registers the workers and returns the handler pg-boss would call for the given queue.
async function getHandler(queue: string): Promise<Handler> {
  await registerTicketWorkers();
  const call = mockedWork.mock.calls.find(([name]) => name === queue);
  return call![1] as unknown as Handler;
}

const processJob = {
  data: { ticketId: 'ticket-1', subject: 'Forgot password', body: 'I forgot my password', requesterName: 'Jane Doe' },
};

beforeEach(() => {
  mockedUpdate.mockReset().mockResolvedValue({} as never);
  mockedUpdateMany.mockReset().mockResolvedValue({ count: 1 } as never);
  mockedReplyCreate.mockReset().mockReturnValue('reply-create-op' as never);
  mockedTransaction.mockReset().mockResolvedValue([] as never);
  mockedClassifyTicket.mockReset();
  mockedAutoResolveTicket.mockReset();
  mockedIsAcknowledgementOnly.mockReset();
  mockedSend.mockReset();
  mockedCreateQueue.mockReset().mockResolvedValue(undefined);
  mockedWork.mockReset().mockResolvedValue('worker-1');
});

describe('processTicketInBackground', () => {
  it('enqueues a processing job with the ticket id, subject, requester name, and message body', () => {
    mockedSend.mockResolvedValue('job-1');

    processTicketInBackground(
      { id: 'ticket-1', subject: 'Refund request', requesterName: 'Jane' } as never,
      { body: 'I want my money back' } as never
    );

    expect(mockedSend).toHaveBeenCalledWith(PROCESS_TICKET_QUEUE, {
      ticketId: 'ticket-1',
      subject: 'Refund request',
      body: 'I want my money back',
      requesterName: 'Jane',
    });
  });

  it('logs and does not throw when enqueueing fails', async () => {
    mockedSend.mockRejectedValue(new Error('upstream failure'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    processTicketInBackground(
      { id: 'ticket-1', subject: 'Refund request', requesterName: null } as never,
      { body: 'I want my money back' } as never
    );
    await new Promise((resolve) => setImmediate(resolve));

    expect(consoleError).toHaveBeenCalledWith('Failed to enqueue processing for ticket ticket-1', expect.any(Error));
    consoleError.mockRestore();
  });
});

describe('followUpTicketInBackground', () => {
  it('enqueues a follow-up job with the ticket id and message body', () => {
    mockedSend.mockResolvedValue('job-1');

    followUpTicketInBackground('ticket-1', 'Thanks!');

    expect(mockedSend).toHaveBeenCalledWith(FOLLOW_UP_TICKET_QUEUE, { ticketId: 'ticket-1', body: 'Thanks!' });
  });
});

describe('registerTicketWorkers', () => {
  it('creates both queues with retry options', async () => {
    await registerTicketWorkers();

    expect(mockedCreateQueue).toHaveBeenCalledWith(PROCESS_TICKET_QUEUE, { retryLimit: 3, retryBackoff: true });
    expect(mockedCreateQueue).toHaveBeenCalledWith(FOLLOW_UP_TICKET_QUEUE, { retryLimit: 3, retryBackoff: true });
  });
});

describe('process-ticket worker', () => {
  const toProcessing = {
    where: { id: 'ticket-1', status: TicketStatus.new },
    data: { status: TicketStatus.processing },
  };
  const toOpen = {
    where: { id: 'ticket-1', status: { in: [TicketStatus.new, TicketStatus.processing] } },
    data: { status: TicketStatus.open },
  };
  const toResolved = {
    where: { id: 'ticket-1', status: TicketStatus.processing },
    data: { status: TicketStatus.resolved },
  };

  beforeEach(() => {
    // Interactive transaction: run the callback against the same mocked client.
    mockedTransaction.mockImplementation((async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)) as never);
  });

  it('marks the ticket processing, classifies it, and resolves it with an AI reply', async () => {
    mockedClassifyTicket.mockResolvedValue(TicketCategory.technicalQuestion);
    mockedAutoResolveTicket.mockResolvedValue('Hi Jane, here is how to reset it.');
    const handler = await getHandler(PROCESS_TICKET_QUEUE);

    await handler([processJob]);

    expect(mockedUpdateMany).toHaveBeenNthCalledWith(1, toProcessing);
    expect(mockedUpdateMany).toHaveBeenCalledWith({
      where: { id: 'ticket-1', category: null },
      data: { category: TicketCategory.technicalQuestion },
    });
    expect(mockedAutoResolveTicket).toHaveBeenCalledWith(
      'Forgot password',
      'I forgot my password',
      TicketCategory.technicalQuestion,
      'Jane'
    );
    expect(mockedUpdateMany).toHaveBeenCalledWith(toResolved);
    expect(mockedReplyCreate).toHaveBeenCalledWith({
      data: { ticketId: 'ticket-1', senderType: SenderType.ai, body: 'Hi Jane, here is how to reset it.' },
    });
    expect(mockedUpdateMany).not.toHaveBeenCalledWith(toOpen);
  });

  it('opens the ticket for an agent when the knowledge base cannot answer it', async () => {
    mockedClassifyTicket.mockResolvedValue(TicketCategory.refundRequest);
    mockedAutoResolveTicket.mockResolvedValue(null);
    const handler = await getHandler(PROCESS_TICKET_QUEUE);

    await handler([processJob]);

    expect(mockedTransaction).not.toHaveBeenCalled();
    expect(mockedUpdateMany).toHaveBeenLastCalledWith(toOpen);
  });

  it('opens the ticket when auto-resolution throws', async () => {
    mockedClassifyTicket.mockResolvedValue(TicketCategory.generalQuestion);
    mockedAutoResolveTicket.mockRejectedValue(new Error('upstream failure'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = await getHandler(PROCESS_TICKET_QUEUE);

    await handler([processJob]);

    expect(mockedTransaction).not.toHaveBeenCalled();
    expect(mockedUpdateMany).toHaveBeenLastCalledWith(toOpen);
    consoleError.mockRestore();
  });

  it('still attempts auto-resolution without a category when classification fails', async () => {
    mockedClassifyTicket.mockRejectedValue(new Error('upstream failure'));
    mockedAutoResolveTicket.mockResolvedValue('Hi there, here is the answer.');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = await getHandler(PROCESS_TICKET_QUEUE);

    await handler([processJob]);

    expect(mockedAutoResolveTicket).toHaveBeenCalledWith('Forgot password', 'I forgot my password', null, 'Jane');
    expect(mockedReplyCreate).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith('Failed to classify ticket ticket-1', expect.any(Error));
    consoleError.mockRestore();
  });

  it('does nothing when the ticket is no longer new (deleted or already processed)', async () => {
    mockedUpdateMany.mockResolvedValueOnce({ count: 0 } as never);
    const handler = await getHandler(PROCESS_TICKET_QUEUE);

    await handler([processJob]);

    expect(mockedUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockedClassifyTicket).not.toHaveBeenCalled();
    expect(mockedAutoResolveTicket).not.toHaveBeenCalled();
  });

  it('does not add the AI reply when the ticket left processing while the AI was working', async () => {
    mockedClassifyTicket.mockResolvedValue(TicketCategory.generalQuestion);
    mockedAutoResolveTicket.mockResolvedValue('Hi Jane, here is the answer.');
    mockedUpdateMany
      .mockResolvedValueOnce({ count: 1 } as never) // new -> processing
      .mockResolvedValueOnce({ count: 1 } as never) // category
      .mockResolvedValueOnce({ count: 0 } as never); // processing -> resolved: status changed meanwhile
    const handler = await getHandler(PROCESS_TICKET_QUEUE);

    await handler([processJob]);

    expect(mockedReplyCreate).not.toHaveBeenCalled();
    expect(mockedUpdateMany).not.toHaveBeenCalledWith(toOpen);
  });
});

describe('follow-up-ticket worker', () => {
  const followUpJob = { data: { ticketId: 'ticket-1', body: 'Thanks!' } };

  it('keeps the ticket resolved when the follow-up is only an acknowledgement', async () => {
    mockedIsAcknowledgementOnly.mockResolvedValue(true);
    const handler = await getHandler(FOLLOW_UP_TICKET_QUEUE);

    await handler([followUpJob]);

    expect(mockedIsAcknowledgementOnly).toHaveBeenCalledWith('Thanks!');
    expect(mockedUpdateMany).not.toHaveBeenCalled();
  });

  it('reopens a still-resolved ticket when the follow-up needs a response', async () => {
    mockedIsAcknowledgementOnly.mockResolvedValue(false);
    const handler = await getHandler(FOLLOW_UP_TICKET_QUEUE);

    await handler([followUpJob]);

    expect(mockedUpdateMany).toHaveBeenCalledWith({
      where: { id: 'ticket-1', status: TicketStatus.resolved },
      data: { status: TicketStatus.open },
    });
  });

  it('reopens the ticket when the acknowledgement check throws', async () => {
    mockedIsAcknowledgementOnly.mockRejectedValue(new Error('upstream failure'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = await getHandler(FOLLOW_UP_TICKET_QUEUE);

    await handler([followUpJob]);

    expect(mockedUpdateMany).toHaveBeenCalledWith({
      where: { id: 'ticket-1', status: TicketStatus.resolved },
      data: { status: TicketStatus.open },
    });
    consoleError.mockRestore();
  });
});
