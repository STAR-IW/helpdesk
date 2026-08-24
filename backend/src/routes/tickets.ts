import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/require-auth.js';

export const ticketsRouter = Router();

ticketsRouter.get('/', requireAuth, async (_req, res) => {
  const tickets = await prisma.ticket.findMany({
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
    orderBy: { createdAt: 'desc' },
  });
  res.json({ tickets });
});