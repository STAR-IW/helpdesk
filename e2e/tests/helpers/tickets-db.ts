// Raw-pg helpers for the inbound-email webhook tests. There is no ticket API
// yet (only the webhook itself), so tests that need to inspect or mutate
// ticket state outside of what the webhook response gives them (e.g. closing
// a ticket, or asserting nothing was created) go straight to Postgres —
// mirroring the pattern in e2e/fixtures/seed-agent.ts.
import pg from 'pg';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set in e2e/.env — see e2e/.env.example`);
  }
  return value;
}

async function withClient<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: requireEnv('DATABASE_URL') });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Marks a ticket as closed directly in the DB (no PATCH-status endpoint exists yet). */
export async function closeTicket(ticketId: string): Promise<void> {
  await withClient((client) =>
    client.query('UPDATE "ticket" SET status = $1 WHERE id = $2', ['closed', ticketId]),
  );
}

/** Deletes a ticket (and, via ON DELETE CASCADE, its messages). Test cleanup helper. */
export async function deleteTicket(ticketId: string): Promise<void> {
  await withClient((client) => client.query('DELETE FROM "ticket" WHERE id = $1', [ticketId]));
}

/** Looks up tickets by requester email, used to assert a rejected webhook call created nothing. */
export async function findTicketsByRequesterEmail(email: string): Promise<Array<{ id: string }>> {
  return withClient(async (client) => {
    const result = await client.query('SELECT id FROM "ticket" WHERE "requesterEmail" = $1', [email]);
    return result.rows;
  });
}