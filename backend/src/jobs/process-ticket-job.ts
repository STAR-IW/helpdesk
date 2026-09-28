import { boss } from './boss.js';
import { prisma } from '../db.js';
import { classifyTicket } from '../ai/classify-ticket.js';
import { autoResolveTicket } from '../ai/auto-resolve-ticket.js';
import { isAcknowledgementOnly } from '../ai/is-acknowledgement.js';
import { SenderType, TicketStatus } from '../generated/prisma/enums.js';
import type { TicketCategory } from '../generated/prisma/enums.js';
import type { Ticket, Message } from '../generated/prisma/client.js';

export const PROCESS_TICKET_QUEUE = 'process-ticket';
export const FOLLOW_UP_TICKET_QUEUE = 'follow-up-ticket';

type ProcessTicketJobData = {
  ticketId: string;
  subject: string;
  body: string;
  requesterName: string | null;
};

type FollowUpTicketJobData = {
  ticketId: string;
  body: string;
};

// Moves a new ticket through the AI pipeline: new -> processing -> classified ->
// resolved (answered from the knowledge base) or open (handed to an agent).
async function processTicket({ ticketId, subject, body, requesterName }: ProcessTicketJobData): Promise<void> {
  try {
    await prisma.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.processing } });

    let category: TicketCategory | null = null;
    try {
      category = await classifyTicket(subject, body);
      await prisma.ticket.update({ where: { id: ticketId }, data: { category } });
    } catch (err) {
      console.error(`Failed to classify ticket ${ticketId}`, err);
    }

    const customerFirstName = requesterName?.trim().split(/\s+/)[0] ?? null;
    const reply = await autoResolveTicket(subject, body, category, customerFirstName);
    if (reply) {
      await prisma.$transaction([
        prisma.reply.create({ data: { ticketId, senderType: SenderType.ai, body: reply } }),
        prisma.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.resolved } }),
      ]);
      return;
    }
  } catch (err) {
    console.error(`Failed to auto-resolve ticket ${ticketId}`, err);
  }

  // Anything the AI couldn't (or failed to) resolve goes to the agent queue, so a
  // ticket never stays hidden in new/processing.
  await prisma.ticket.update({ where: { id: ticketId }, data: { status: TicketStatus.open } });
}

// Reopens a resolved ticket when the customer's follow-up needs a response. A plain
// "thanks" keeps it resolved; if the AI check fails, reopen to be safe.
async function followUpTicket({ ticketId, body }: FollowUpTicketJobData): Promise<void> {
  try {
    if (await isAcknowledgementOnly(body)) return;
  } catch (err) {
    console.error(`Failed to check follow-up for ticket ${ticketId}`, err);
  }

  await prisma.ticket.updateMany({
    where: { id: ticketId, status: TicketStatus.resolved },
    data: { status: TicketStatus.open },
  });
}

export async function registerTicketWorkers(): Promise<void> {
  await boss.createQueue(PROCESS_TICKET_QUEUE, { retryLimit: 3, retryBackoff: true });
  await boss.createQueue(FOLLOW_UP_TICKET_QUEUE, { retryLimit: 3, retryBackoff: true });

  await boss.work<ProcessTicketJobData>(PROCESS_TICKET_QUEUE, ([job]) => processTicket(job.data));
  await boss.work<FollowUpTicketJobData>(FOLLOW_UP_TICKET_QUEUE, ([job]) => followUpTicket(job.data));
}

// Enqueues AI processing for a newly created ticket without waiting on the AI calls
// (a pg-boss worker processes the job separately) or on the enqueue itself.
export function processTicketInBackground(ticket: Ticket, message: Message): void {
  const data: ProcessTicketJobData = {
    ticketId: ticket.id,
    subject: ticket.subject,
    body: message.body,
    requesterName: ticket.requesterName,
  };
  boss.send(PROCESS_TICKET_QUEUE, data).catch((err) => {
    console.error(`Failed to enqueue processing for ticket ${ticket.id}`, err);
  });
}

// Enqueues a check of a customer's follow-up to a resolved ticket.
export function followUpTicketInBackground(ticketId: string, body: string): void {
  const data: FollowUpTicketJobData = { ticketId, body };
  boss.send(FOLLOW_UP_TICKET_QUEUE, data).catch((err) => {
    console.error(`Failed to enqueue follow-up check for ticket ${ticketId}`, err);
  });
}
