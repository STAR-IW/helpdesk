import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  AGENT_EMAIL,
  AGENT_PASSWORD,
  submitLogin,
  loginAsAdmin,
  loginAsAgent,
} from './helpers/auth.js';

test.describe('Login page', () => {
  test('valid admin credentials redirect to the dashboard', async ({ page }) => {
    await submitLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await expect(page).toHaveURL('/');
    await expect(page.getByText("You're logged in.")).toBeVisible();
  });

  test('wrong password for an existing email shows an inline error and stays on /login', async ({
    page,
  }) => {
    await submitLogin(page, ADMIN_EMAIL, 'definitely-the-wrong-password');

    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('email that does not exist shows an inline error and stays on /login', async ({ page }) => {
    await submitLogin(page, 'no-such-user@e2e.test', 'whatever-password');

    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('empty email and password show client-side validation errors and do not navigate', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('invalid email format shows a client-side validation error and does not navigate', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password').fill('some-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Enter a valid email address')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('visiting /login while already authenticated renders the login page (no redirect)', async ({
    page,
  }) => {

    await loginAsAdmin(page);

    await page.goto('/login');

    await expect(page).toHaveURL('/login');
    await expect(page.getByText('Helpdesk Login')).toBeVisible();
  });
});

test.describe('Route protection', () => {
  test('unauthenticated user visiting / is redirected to /login', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL('/login');
  });

  test('unauthenticated user visiting /users is redirected to /login', async ({ page }) => {
    await page.goto('/users');

    await expect(page).toHaveURL('/login');
  });

  test('authenticated admin can reach /users', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/users');

    await expect(page).toHaveURL('/users');
    await expect(page.getByText('Users')).toBeVisible();
  });

  test('authenticated agent visiting /users is redirected to /', async ({ page }) => {
    await loginAsAgent(page);

    await page.goto('/users');

    await expect(page).toHaveURL('/');
  });

  test('authenticated user reloading / stays authenticated', async ({ page }) => {
    await loginAsAdmin(page);

    await page.reload();

    await expect(page).toHaveURL('/');
    await expect(page.getByText("You're logged in.")).toBeVisible();
  });
});

test.describe('Sign out', () => {
  test('signing out redirects to /login and clears the session server-side', async ({ page }) => {
    await loginAsAdmin(page);

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/login');


    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});
