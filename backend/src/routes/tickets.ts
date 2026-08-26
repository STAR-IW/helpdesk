import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/require-auth.js';
import { TicketStatus, TicketCategory } from '../generated/prisma/enums.js';

export const ticketsRouter = Router();

const listTicketsQuerySchema = z.object({
  sortBy: z.enum(['subject', 'requesterName', 'status', 'category', 'createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  status: z.enum(TicketStatus).optional(),
  category: z.enum(TicketCategory).optional(),
  search: z.string().trim().min(1).optional(),
});

ticketsRouter.get('/', requireAuth, async (req, res) => {
  const parsed = listTicketsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { sortBy, sortOrder, status, category, search } = parsed.data;

  const orderBy =
    sortBy === 'requesterName' || sortBy === 'category'
      ? { [sortBy]: { sort: sortOrder, nulls: 'last' as const } }
      : { [sortBy]: sortOrder };

  const tickets = await prisma.ticket.findMany({
    where: {
      ...(status && { status }),
      ...(category && { category }),
      ...(search && {
        OR: [
          { subject: { contains: search, mode: 'insensitive' } },
          { requesterEmail: { contains: search, mode: 'insensitive' } },
          { requesterName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    },
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
  });
  res.json({ tickets });
});