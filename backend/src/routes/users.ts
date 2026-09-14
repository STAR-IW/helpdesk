import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/require-auth.js';
import { Role } from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';

export const usersRouter = Router();

usersRouter.get('/', requireAuth, requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { name: 'asc' },
  });
  res.json({ users });
});

const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Name must be at least 3 characters')
    .regex(/^[A-Za-z\s]+$/, 'Name can only contain letters'),
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

usersRouter.post('/', requireAuth, requireAdmin, async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { name, email, password } = parsed.data;

  try {
    const userId = randomUUID();
    const hashed = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        id: userId,
        name,
        email,
        emailVerified: true,
        role: Role.agent,
        accounts: {
          create: {
            id: randomUUID(),
            accountId: userId,
            providerId: 'credential',
            password: hashed,
          },
        },
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    res.status(201).json({ user });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      res.status(409).json({ error: 'A user with this email already exists' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Name must be at least 3 characters')
    .regex(/^[A-Za-z\s]+$/, 'Name can only contain letters'),
  email: z.email('Enter a valid email address'),
  password: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : val),
    z.string().min(8, 'Password must be at least 8 characters').optional()
  ),
});

usersRouter.patch<{ id: string }>('/:id', requireAuth, requireAdmin, async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const { name, email, password } = parsed.data;
  const { id } = req.params;

  try {
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { name, email },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });

      if (password) {
        const hashed = await hashPassword(password);
        await tx.account.updateMany({
          where: { userId: id, providerId: 'credential' },
          data: { password: hashed },
        });
      }

      return updated;
    });

    res.json({ user });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        res.status(409).json({ error: 'A user with this email already exists' });
        return;
      }
      if (err.code === 'P2025') {
        res.status(404).json({ error: 'User not found' });
        return;
      }
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

usersRouter.delete<{ id: string }>('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { role: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  if (user.role === Role.admin) {
    res.status(403).json({ error: 'Admin users cannot be deleted' });
    return;
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { deletedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: id } }),
    prisma.ticket.updateMany({ where: { assignedAgentId: id }, data: { assignedAgentId: null } }),
  ]);

  res.status(204).end();
});
