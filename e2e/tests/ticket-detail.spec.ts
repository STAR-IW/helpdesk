import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { AGENT_EMAIL, loginAsAdmin, loginAsAgent } from './helpers/auth.js';
import { deleteTicket } from './helpers/tickets-db.js';

// Everything about the ticket detail page's own rendering/interaction logic
// (subject/requester/dates, messages, status/category/assignment selects,
// reply form validation, error states, ...) is covered with a mocked API by
// TicketDetailPage.test.tsx, TicketDetails.test.tsx, and ReplyThread.test.tsx.
// The tests here only cover what those mocks can't: a real PATCH/POST actually
// persisting through the backend into Postgres, and role gating driven by a
// real logged-in session rather than a mocked `useSession`.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set in e2e/.env — see e2e/.env.example`);
  }
  return value;
}

const API_ORIGIN = requireEnv('BETTER_AUTH_URL');
const WEBHOOK_URL = `${API_ORIGIN}/api/webhooks/inbound-email`;
const WEBHOOK_SECRET = requireEnv('INBOUND_EMAIL_WEBHOOK_SECRET');

function randomLetters(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

type SeededTicket = {
  id: string;
  subject: string;
  requesterEmail: string;
  requesterName: string;
  messageBody: string;
};

/**
 * Seeds a ticket the same way real support email does — there is no manual
 * ticket-creation API, only the inbound-email webhook (see inbound-email.spec.ts).
 */
async function createTicket(
  request: APIRequestContext,
  overrides: Partial<{ subject: string; text: string }> = {},
): Promise<SeededTicket> {
  const suffix = randomLetters(8);
  const payload = {
    from: `requester-${suffix}@e2e.test`,
    fromName: `QA Requester ${suffix}`,
    to: 'support@e2e.test',
    subject: overrides.subject ?? `Ticket detail test ${suffix}`,
    text: overrides.text ?? `Body text for ticket ${suffix}.`,
  };

  const response = await request.post(WEBHOOK_URL, {
    data: payload,
    headers: { 'X-Webhook-Secret': WEBHOOK_SECRET },
  });
  if (response.status() !== 201) {
    throw new Error(`Failed to seed ticket: ${response.status()} ${await response.text()}`);
  }
  const body = (await response.json()) as { ticket: { id: string } };

  return {
    id: body.ticket.id,
    subject: payload.subject,
    requesterEmail: payload.from,
    requesterName: payload.fromName,
    messageBody: payload.text,
  };
}

/** Looks up a user's id/name via the admin-only users API. Caller must already be logged in as admin. */
async function getUserByEmail(page: Page, email: string): Promise<{ id: string; name: string }> {
  const response = await page.request.get(`${API_ORIGIN}/api/users`);
  expect(response.status()).toBe(200);
  const { users } = (await response.json()) as {
    users: Array<{ id: string; name: string; email: string }>;
  };
  const match = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!match) throw new Error(`No user found with email ${email}`);
  return { id: match.id, name: match.name };
}

/** Opens a "Ticket status"/"Ticket category"/"Assigned agent" select and picks an option, waiting for the resulting PATCH. */
async function selectOptionAndWaitForPatch(
  page: Page,
  ticketId: string,
  comboboxName: string,
  optionName: string,
) {
  await page.getByRole('combobox', { name: comboboxName }).click();
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url() === `${API_ORIGIN}/api/tickets/${ticketId}` && res.request().method() === 'PATCH',
    ),
    page.getByRole('option', { name: optionName, exact: true }).click(),
  ]);
  return response;
}

test.describe('Ticket detail page', () => {
  test('status, category, and agent assignment changes persist through a real reload', async ({
    page,
    request,
  }) => {
    const ticket = await createTicket(request);
    try {
      await loginAsAdmin(page);
      await page.goto(`/tickets/${ticket.id}`);

      const agent = await getUserByEmail(page, AGENT_EMAIL);

      const statusResponse = await selectOptionAndWaitForPatch(page, ticket.id, 'Ticket status', 'Resolved');
      expect(statusResponse.status()).toBe(200);

      const categoryResponse = await selectOptionAndWaitForPatch(
        page,
        ticket.id,
        'Ticket category',
        'Technical question',
      );
      expect(categoryResponse.status()).toBe(200);

      const assignResponse = await selectOptionAndWaitForPatch(page, ticket.id, 'Assigned agent', agent.name);
      expect(assignResponse.status()).toBe(200);

      // The mocked-API component tests prove the UI calls PATCH with the right
      // body; only a real reload against the real backend/DB proves it stuck.
      await page.reload();

      await expect(page.getByRole('combobox', { name: 'Ticket status' })).toContainText('Resolved');
      await expect(page.getByRole('combobox', { name: 'Ticket category' })).toContainText(
        'Technical question',
      );
      await expect(page.getByRole('combobox', { name: 'Assigned agent' })).toContainText(agent.name);
    } finally {
      await deleteTicket(ticket.id);
    }
  });

  test('a non-admin agent sees the assigned agent as read-only text with no dropdown', async ({
    browser,
    request,
  }) => {
    const ticket = await createTicket(request);
    try {
      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      let agentName: string;
      try {
        await loginAsAdmin(adminPage);
        const agent = await getUserByEmail(adminPage, AGENT_EMAIL);
        agentName = agent.name;
        const patchResponse = await adminPage.request.patch(`${API_ORIGIN}/api/tickets/${ticket.id}`, {
          data: { agentId: agent.id },
        });
        expect(patchResponse.status()).toBe(200);
      } finally {
        await adminContext.close();
      }

      // The mocked-API component test already proves isAdmin=false renders
      // read-only text; this proves a *real* agent session actually resolves
      // to isAdmin=false end-to-end (real login, real session, real role field).
      const agentContext = await browser.newContext();
      const agentPage = await agentContext.newPage();
      try {
        await loginAsAgent(agentPage);
        await agentPage.goto(`/tickets/${ticket.id}`);

        // Scoped to <main> — the logged-in agent's own name (also "Agent") appears
        // in the navbar too, which would otherwise make this an ambiguous match.
        await expect(agentPage.getByRole('main').getByText(agentName, { exact: true })).toBeVisible();
        await expect(agentPage.getByRole('combobox', { name: 'Assigned agent' })).toHaveCount(0);
      } finally {
        await agentContext.close();
      }
    } finally {
      await deleteTicket(ticket.id);
    }
  });

  test('a submitted reply persists through a real reload', async ({ page, request }) => {
    const ticket = await createTicket(request);
    try {
      await loginAsAdmin(page);
      await page.goto(`/tickets/${ticket.id}`);

      const replyBody = `Reply body ${randomLetters(8)}`;
      await page.getByLabel('Reply message').fill(replyBody);

      const [response] = await Promise.all([
        page.waitForResponse(
          (res) =>
            res.url() === `${API_ORIGIN}/api/tickets/${ticket.id}/replies` && res.request().method() === 'POST',
        ),
        page.getByRole('button', { name: 'Send reply' }).click(),
      ]);
      expect(response.status()).toBe(201);

      // The mocked-API component test proves the UI re-renders on a successful
      // POST; only a real reload proves the reply (and its senderType/author)
      // actually made it into Postgres.
      await page.reload();

      await expect(page.getByText(replyBody)).toBeVisible();
      await expect(page.getByText('(Agent)')).toBeVisible();
    } finally {
      await deleteTicket(ticket.id);
    }
  });
});
