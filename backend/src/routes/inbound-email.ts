import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireWebhookSecret } from '../middleware/require-webhook-secret.js';
import { Prisma, type Ticket, type Message } from '../generated/prisma/client.js';
import { TicketStatus } from '../generated/prisma/enums.js';
import { sanitizeHtml } from '../sanitize.js';
import { classifyTicket } from '../ai/classify-ticket.js';

export const inboundEmailRouter = Router();

const inboundEmailSchema = z.object({
  from: z.email('from must be a valid email address').max(254, 'from must be at most 254 characters'),
  fromName: z.string().trim().min(1).max(255, 'fromName must be at most 255 characters').optional(),
  to: z.email('to must be a valid email address').max(254, 'to must be at most 254 characters'),
  subject: z.string().trim().min(1, 'subject is required').max(500, 'subject must be at most 500 characters'),
  text: z.string().min(1, 'text is required').max(50000, 'text must be at most 50000 characters'),
  html: z.string().max(100000, 'html must be at most 100000 characters').optional(),
  messageId: z.string().trim().min(1).max(998, 'messageId must be at most 998 characters').optional(),
  inReplyTo: z.string().trim().min(1).max(998, 'inReplyTo must be at most 998 characters').optional(),
  references: z.string().trim().min(1).max(2000, 'references must be at most 2000 characters').optional(),
});

// Strips repeated Re:/Fwd: prefixes and normalizes case so "Re: Fwd: Help"
// and "help" are recognized as the same underlying subject.
function normalizeSubject(subject: string): string {
  let normalized = subject.trim();
  let previous: string;
  do {
    previous = normalized;
    normalized = normalized.replace(/^(re|fwd?):\s*/i, '');
  } while (normalized !== previous);
  return normalized.toLowerCase();
}

// Fires the classification call and writes the result once it resolves, without
// making the webhook response wait on the AI call.
function classifyTicketInBackground(ticket: Ticket, message: Message): void {
  classifyTicket(ticket.subject, message.body)
    .then((category) => prisma.ticket.update({ where: { id: ticket.id }, data: { category } }))
    .catch((err) => {
      console.error(`Failed to classify ticket ${ticket.id}`, err);
    });
}

inboundEmailRouter.post('/', requireWebhookSecret, async (req, res) => {
  const parsed = inboundEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { from, fromName, to, subject, text, html, messageId, inReplyTo, references } = parsed.data;
  const messageData = {
    fromEmail: from,
    fromName,
    toEmail: to,
    body: text,
    bodyHtml: html ? sanitizeHtml(html) : html,
    messageId,
    inReplyTo,
    references,
  };

  try {
    const normalizedSubject = normalizeSubject(subject);
    const openTickets = await prisma.ticket.findMany({
      where: { requesterEmail: from, status: { not: TicketStatus.closed } },
      orderBy: { createdAt: 'desc' },
    });
    const existingTicket = openTickets.find((t) => normalizeSubject(t.subject) === normalizedSubject);

    const ticket = existingTicket
      ? await prisma.ticket.update({
          where: { id: existingTicket.id },
          data: { messages: { create: messageData } },
          include: { messages: true },
        })
      : await prisma.ticket.create({
          data: { subject, requesterEmail: from, requesterName: fromName, messages: { create: messageData } },
          include: { messages: true },
        });

    if (!existingTicket) {
      classifyTicketInBackground(ticket, ticket.messages[0]);
    }

    res.status(201).json({ ticket });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'A message with this messageId has already been received' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create ticket from inbound email' });
  }
});
