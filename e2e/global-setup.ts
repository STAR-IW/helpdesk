import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { seedAgentUser } from './fixtures/seed-agent.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(__dirname, '../backend');

export default async function globalSetup() {
  execSync('npx prisma migrate reset --force', { cwd: backendDir, stdio: 'inherit' });
  execSync('npx prisma db seed', { cwd: backendDir, stdio: 'inherit' });
  // Backend's seed script only creates the admin (from ADMIN_EMAIL/ADMIN_PASSWORD).
  // Add an agent-role account too, so role-gating tests have someone to log in as.
  await seedAgentUser();
}
