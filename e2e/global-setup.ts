import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(__dirname, '../backend');

export default function globalSetup() {
  execSync('npx prisma migrate reset --force', { cwd: backendDir, stdio: 'inherit' });
  execSync('npx prisma db seed', { cwd: backendDir, stdio: 'inherit' });
}
