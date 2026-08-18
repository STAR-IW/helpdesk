import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireWebhookSecret } from '../middleware/require-webhook-secret.js';
import { Prisma } from '../generated/prisma/client.js';
import { TicketStatus } from '../generated/prisma/enums.js';

export const inboundEmailRouter = Router();

const inboundEmailSchema = z.object({
  from: z.email('from must be a valid email address'),
  fromName: z.string().trim().min(1).optional(),
  to: z.email('to must be a valid email address'),
  subject: z.string().trim().min(1, 'subject is required'),
  text: z.string().min(1, 'text is required'),
  messageId: z.string().trim().min(1).optional(),
  inReplyTo: z.string().trim().min(1).optional(),
  references: z.string().trim().min(1).optional(),
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

inboundEmailRouter.post('/', requireWebhookSecret, async (req, res) => {
  const parsed = inboundEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { from, fromName, to, subject, text, messageId, inReplyTo, references } = parsed.data;
  const messageData = { fromEmail: from, fromName, toEmail: to, body: text, messageId, inReplyTo, references };

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
