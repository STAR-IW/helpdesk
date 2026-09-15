import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/require-auth.js';
import { TicketStatus, TicketCategory, Role, SenderType } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import { polishReply } from '../ai/polish-reply.js';
import { summarizeTicket } from '../ai/summarize-ticket.js';

export const ticketsRouter = Router();

const listTicketsQuerySchema = z.object({
  sortBy: z.enum(['subject', 'requesterName', 'status', 'category', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(TicketStatus).optional(),
  category: z.enum(TicketCategory).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

ticketsRouter.get('/', requireAuth, async (req, res) => {
  const parsed = listTicketsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { sortBy, sortOrder, status, category, search, page, pageSize } = parsed.data;

  const orderBy =
    sortBy === 'requesterName' || sortBy === 'category'
      ? { [sortBy]: { sort: sortOrder, nulls: 'last' as const } }
      : { [sortBy]: sortOrder };

  const where = {
    ...(status && { status }),
    ...(category && { category }),
    ...(search && {
      OR: [
        { subject: { contains: search, mode: 'insensitive' as const } },
        { requesterEmail: { contains: search, mode: 'insensitive' as const } },
        { requesterName: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const [total, tickets] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      select: {
        id: true,
        subject: true,
        status: true,
        category: true,
        requesterEmail: true,
        requesterName: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({ tickets, total, page, pageSize });
});

ticketsRouter.get<{ id: string }>('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: {
      id: true,
      subject: true,
      status: true,
      category: true,
      requesterEmail: true,
      requesterName: true,
      assignedAgent: { select: { id: true, name: true, email: true } },
      createdAt: true,
      updatedAt: true,
      messages: {
        select: {
          id: true,
          fromEmail: true,
          fromName: true,
          toEmail: true,
          body: true,
          bodyHtml: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
      replies: {
        select: {
          id: true,
          senderType: true,
          body: true,
          bodyHtml: true,
          author: { select: { id: true, name: true } },
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  res.json({ ticket });
});

const createReplySchema = z.object({
  body: z.string().trim().min(1, 'Reply body is required'),
});

ticketsRouter.post<{ id: string }>('/:id/replies', requireAuth, async (req, res) => {
  const parsed = createReplySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { id } = req.params;

  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { id: true } });
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const reply = await prisma.reply.create({
    data: {
      ticketId: id,
      senderType: SenderType.agent,
      authorId: req.user!.id,
      body: parsed.data.body,
    },
    select: {
      id: true,
      senderType: true,
      body: true,
      bodyHtml: true,
      author: { select: { id: true, name: true } },
      createdAt: true,
    },
  });

  res.status(201).json({ reply });
});

ticketsRouter.post<{ id: string }>('/:id/summary', requireAuth, async (req, res) => {
  const { id } = req.params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: {
      subject: true,
      requesterName: true,
      requesterEmail: true,
      messages: {
        select: { fromName: true, fromEmail: true, body: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
      replies: {
        select: {
          body: true,
          createdAt: true,
          senderType: true,
          author: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const entries = [
    ...ticket.messages.map((message) => ({
      from: message.fromName ?? message.fromEmail,
      body: message.body,
      createdAt: message.createdAt,
    })),
    ...ticket.replies.map((reply) => ({
      from: reply.author?.name ?? (reply.senderType === SenderType.agent ? 'Agent' : 'Customer'),
      body: reply.body,
      createdAt: reply.createdAt,
    })),
  ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (entries.length === 0) {
    res.status(400).json({ error: 'Ticket has no messages to summarize' });
    return;
  }

  try {
    const summary = await summarizeTicket(ticket.subject, entries);
    res.json({ summary });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to summarize ticket' });
  }
});

const polishReplySchema = z.object({
  body: z.string().trim().min(1, 'Reply body is required').max(1500),
});

ticketsRouter.post<{ id: string }>('/:id/replies/polish', requireAuth, async (req, res) => {
  const parsed = polishReplySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { id } = req.params;

  // Get context from DB to ground the polish prompt (ticket subject, customer name)
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { subject: true, requesterName: true },
  });
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  const customerFirstName = ticket.requesterName?.trim().split(/\s+/)[0] ?? null;

  try {
    const text = await polishReply(parsed.data.body, ticket.subject, req.user!.name, customerFirstName);
    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'Failed to polish reply' });
  }
});

const updateTicketSchema = z
  .object({
    status: z.enum(TicketStatus).optional(),
    category: z.enum(TicketCategory).nullable().optional(),
    agentId: z.string().min(1).nullable().optional(),
  })
  .refine(
    (data) => data.status !== undefined || data.category !== undefined || data.agentId !== undefined,
    { message: 'At least one of status, category, or agentId is required' }
  );

ticketsRouter.patch<{ id: string }>('/:id', requireAuth, async (req, res) => {
  const parsed = updateTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { status, category, agentId } = parsed.data;
  const { id } = req.params;

  if (agentId !== undefined && req.user?.role !== Role.admin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  if (agentId) {
    const agent = await prisma.user.findUnique({
      where: { id: agentId },
      select: { deletedAt: true },
    });
    if (!agent || agent.deletedAt) {
      res.status(400).json({ error: 'Agent not found' });
      return;
    }
  }

  try {
    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(category !== undefined && { category }),
        ...(agentId !== undefined && { assignedAgentId: agentId }),
      },
      select: {
        id: true,
        subject: true,
        status: true,
        category: true,
        requesterEmail: true,
        requesterName: true,
        assignedAgent: { select: { id: true, name: true, email: true } },
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json({ ticket });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update ticket' });
  }
});