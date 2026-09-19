import { boss } from './boss.js';
import { prisma } from '../db.js';
import { classifyTicket } from '../ai/classify-ticket.js';
import type { Ticket, Message } from '../generated/prisma/client.js';

export const CLASSIFY_TICKET_QUEUE = 'classify-ticket';

type ClassifyTicketJobData = {
  ticketId: string;
  subject: string;
  body: string;
};

export async function registerClassifyTicketWorker(): Promise<void> {
  await boss.createQueue(CLASSIFY_TICKET_QUEUE, { retryLimit: 3, retryBackoff: true });

  await boss.work<ClassifyTicketJobData>(CLASSIFY_TICKET_QUEUE, async ([job]) => {
    const category = await classifyTicket(job.data.subject, job.data.body);
    await prisma.ticket.update({ where: { id: job.data.ticketId }, data: { category } });
  });
}

// Enqueues classification for a newly created ticket without waiting on the AI call
// (a pg-boss worker processes the job separately) or on the enqueue itself.
export function classifyTicketInBackground(ticket: Ticket, message: Message): void {
  const data: ClassifyTicketJobData = { ticketId: ticket.id, subject: ticket.subject, body: message.body };
  boss.send(CLASSIFY_TICKET_QUEUE, data).catch((err) => {
    console.error(`Failed to enqueue classification for ticket ${ticket.id}`, err);
  });
}
