
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import pg from 'pg';

export async function seedAgentUser(): Promise<void> {
  const email = process.env.AGENT_EMAIL;
  const password = process.env.AGENT_PASSWORD;
  const connectionString = process.env.DATABASE_URL;

  if (!email || !password) {
    throw new Error('AGENT_EMAIL and AGENT_PASSWORD must be set in the environment');
  }
  if (!connectionString) {
    throw new Error('DATABASE_URL must be set in the environment');
  }

  // User.email is always stored lowercase (see backend/src/db.ts) — better-auth's
  // sign-in lookup lowercases the email it queries with.
  const normalizedEmail = email.toLowerCase();

  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const existing = await client.query('SELECT id FROM "user" WHERE email = $1', [normalizedEmail]);
    if (existing.rowCount && existing.rowCount > 0) {
      console.log(`Agent user ${normalizedEmail} already exists, skipping.`);
      return;
    }

    const userId = randomUUID();
    const hashed = await hashPassword(password);
    const now = new Date();

    await client.query(
      `INSERT INTO "user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, 'Agent', normalizedEmail, true, 'agent', now, now],
    );

    await client.query(
      `INSERT INTO "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [randomUUID(), userId, 'credential', userId, hashed, now, now],
    );

    console.log(`Created agent user ${normalizedEmail} (${userId})`);
  } finally {
    await client.end();
  }
}