import { prisma } from './db.js';

// The "AI" agent is a regular user row (created by prisma/seed.ts, with no login
// credentials) that owns new tickets while the AI pipeline works on them, and keeps
// the tickets it auto-resolves. It has a fixed id so code can refer to it directly.
export const AI_AGENT_ID = 'ai-agent';
export const AI_AGENT_EMAIL = 'ai@helpdesk.local';
export const AI_AGENT_NAME = 'AI';

let aiAgentExists = false;

// Returns AI_AGENT_ID when the AI agent has been seeded, null otherwise — for writes
// that assign it (assignedAgentId must reference an existing user). Only a positive
// result is cached, so seeding it later takes effect without a restart.
export async function getAiAgentIdIfSeeded(): Promise<string | null> {
  if (!aiAgentExists) {
    const user = await prisma.user.findFirst({
      where: { id: AI_AGENT_ID, deletedAt: null },
      select: { id: true },
    });
    aiAgentExists = user !== null;
  }
  return aiAgentExists ? AI_AGENT_ID : null;
}
