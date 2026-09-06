import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/require-auth.js';
import { TicketStatus, TicketCategory, Role } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';

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