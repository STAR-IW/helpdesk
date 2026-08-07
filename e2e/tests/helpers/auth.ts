// Shared login helpers for the e2e suite. Credentials always come from
// e2e/.env (loaded by playwright.config.ts) — never hardcode them here.
import { expect, type Page } from '@playwright/test';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set in e2e/.env — see e2e/.env.example`);
  }
  return value;
}

export const ADMIN_EMAIL = requireEnv('ADMIN_EMAIL');
export const ADMIN_PASSWORD = requireEnv('ADMIN_PASSWORD');

// Seeded directly by e2e/global-setup.ts (via e2e/fixtures/seed-agent.ts),
// not by backend/prisma/seed.ts — there is currently no in-product way to
// create an agent account (no self-signup, admin "create agent" UI is a
// stub). See that fixture for details.
export const AGENT_EMAIL = requireEnv('AGENT_EMAIL');
export const AGENT_PASSWORD = requireEnv('AGENT_PASSWORD');

/** Fills and submits the login form. Does not assert the outcome. */
export async function submitLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** Logs in and waits for the post-login redirect to the dashboard. */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await submitLogin(page, email, password);
  await expect(page).toHaveURL('/');
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
}

export async function loginAsAgent(page: Page): Promise<void> {
  await login(page, AGENT_EMAIL, AGENT_PASSWORD);
}
