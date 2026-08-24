import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

loadEnv({ path: resolve(__dirname, '.env') });

const backendDir = resolve(__dirname, '../backend');
const frontendDir = resolve(__dirname, '../frontend');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './global-setup.ts',
  globalTeardown: './global-teardown.ts',
  webServer: [
    {
      name: 'backend',
      command: 'npm run dev',
      cwd: backendDir,
      url: 'http://localhost:3001/api/health',
      env: {
        NODE_ENV: 'test',
        PORT: process.env.PORT!,
        DATABASE_URL: process.env.DATABASE_URL!,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL!,
        FRONTEND_URL: process.env.FRONTEND_URL!,
        INBOUND_EMAIL_WEBHOOK_SECRET: process.env.INBOUND_EMAIL_WEBHOOK_SECRET!,
      },
      // Dedicated port (not the dev default 3000): guarantees this can never
      // collide with a manually-running dev backend, which reuseExistingServer
      // would otherwise silently reuse — pointing tests at the wrong database.
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      name: 'frontend',
      command: 'npm run dev -- --port 5174 --strictPort',
      cwd: frontendDir,
      url: 'http://localhost:5174',
      env: {
        // Overrides root .env's VITE_API_URL (frontend/vite.config.ts's
        // envDir points there) — process.env vars take priority over .env
        // file values in Vite, so this is what actually wires the frontend
        // to the e2e backend above instead of the dev one.
        VITE_API_URL: process.env.VITE_API_URL!,
      },
      // Dedicated port (not the dev default 5173), same reasoning as backend above.
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
