import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/require-auth.js';
import { AI_AGENT_ID } from '../ai-agent.js';

export const dashboardRouter = Router();

type DashboardStats = {
  stats: {
    totalTickets: number;
    openTickets: number;
    aiResolvedTickets: number;
    aiResolvedPercent: number;
    avgResolutionSeconds: number | null;
  };
  ticketsPerDay: { date: string; count: number }[];
};

// The numbers are computed by the dashboard_stats() database function (see the
// add_dashboard_stats_function migration), which returns this endpoint's JSON body.
dashboardRouter.get('/stats', requireAuth, async (_req, res) => {
  const [{ dashboard }] = await prisma.$queryRaw<{ dashboard: DashboardStats }[]>`
    SELECT dashboard_stats(${AI_AGENT_ID}) AS dashboard
  `;
  res.json(dashboard);
});
