import { boss } from './boss.js';
import { prisma } from '../db.js';
import { classifyTicket } from '../ai/classify-ticket.js';
import { autoResolveTicket } from '../ai/auto-resolve-ticket.js';
import { isAcknowledgementOnly } from '../ai/is-acknowledgement.js';
import { AI_AGENT_ID } from '../ai-agent.js';
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
// resolved (answered from the knowledge base, stays assigned to the AI agent) or open
// (unassigned from the AI agent and handed to the human queue).
// Status changes use updateMany guarded on the expected current status, so they never
// throw when the ticket was deleted meanwhile, and never overwrite a manual change.
async function processTicket({ ticketId, subject, body, requesterName }: ProcessTicketJobData): Promise<void> {
  try {
    const { count } = await prisma.ticket.updateMany({
      where: { id: ticketId, status: TicketStatus.new },
      data: { status: TicketStatus.processing },
    });
    // Ticket deleted, or already picked up by an earlier attempt/changed by an agent.
    if (count === 0) return;

    let category: TicketCategory | null = null;
    try {
      category = await classifyTicket(subject, body);
      await prisma.ticket.updateMany({ where: { id: ticketId, category: null }, data: { category } });
    } catch (err) {
      console.error(`Failed to classify ticket ${ticketId}`, err);
    }

    const customerFirstName = requesterName?.trim().split(/\s+/)[0] ?? null;
    const reply = await autoResolveTicket(subject, body, category, customerFirstName);
    if (reply) {
      await prisma.$transaction(async (tx) => {
        const resolved = await tx.ticket.updateMany({
          where: { id: ticketId, status: TicketStatus.processing },
          data: { status: TicketStatus.resolved, resolvedAt: new Date() },
        });
        if (resolved.count === 1) {
          await tx.reply.create({ data: { ticketId, senderType: SenderType.ai, body: reply } });
        }
      });
      return;
    }
  } catch (err) {
    console.error(`Failed to auto-resolve ticket ${ticketId}`, err);
  }

  // Anything the AI couldn't (or failed to) resolve goes to the agent queue, so a
  // ticket never stays hidden in new/processing.
  await prisma.ticket.updateMany({
    where: { id: ticketId, status: { in: [TicketStatus.new, TicketStatus.processing] } },
    data: { status: TicketStatus.open },
  });
  await unassignFromAiAgent(ticketId);
}

// Hands an open ticket back to the human queue. Guarded on the AI agent still being
// the assignee, so a manual reassignment by an admin is never overwritten.
async function unassignFromAiAgent(ticketId: string): Promise<void> {
  await prisma.ticket.updateMany({
    where: { id: ticketId, assignedAgentId: AI_AGENT_ID, status: TicketStatus.open },
    data: { assignedAgentId: null },
  });
}

// Reopens a resolved ticket when the customer's follow-up needs a response. A plain
// "thanks" keeps it resolved; if the AI check fails, reopen to be safe. A reopened
// ticket needs a human, so it's also taken away from the AI agent.
async function followUpTicket({ ticketId, body }: FollowUpTicketJobData): Promise<void> {
  try {
    if (await isAcknowledgementOnly(body)) return;
  } catch (err) {
    console.error(`Failed to check follow-up for ticket ${ticketId}`, err);
  }

  await prisma.ticket.updateMany({
    where: { id: ticketId, status: TicketStatus.resolved },
    data: { status: TicketStatus.open, resolvedAt: null },
  });
  await unassignFromAiAgent(ticketId);
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
