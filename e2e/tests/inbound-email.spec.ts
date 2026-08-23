import { test, expect, type APIRequestContext } from '@playwright/test';
import { closeTicket, deleteTicket, findTicketsByRequesterEmail } from './helpers/tickets-db.js';

const API_ORIGIN = 'http://localhost:3000';
const WEBHOOK_URL = `${API_ORIGIN}/api/webhooks/inbound-email`;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set in e2e/.env — see e2e/.env.example`);
  }
  return value;
}

const WEBHOOK_SECRET = requireEnv('INBOUND_EMAIL_WEBHOOK_SECRET');

function randomLetters(length: number): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return result;
}

type InboundEmailPayload = {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  text: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
};

type TicketMessage = {
  id: string;
  fromEmail: string;
  fromName: string | null;
  toEmail: string;
  body: string;
  messageId: string | null;
};

type Ticket = {
  id: string;
  subject: string;
  status: 'open' | 'resolved' | 'closed';
  category: string | null;
  requesterEmail: string;
  requesterName: string | null;
  messages: TicketMessage[];
};

function postInboundEmail(
  request: APIRequestContext,
  payload: Partial<InboundEmailPayload> | Record<string, unknown>,
  headers: Record<string, string> = { 'X-Webhook-Secret': WEBHOOK_SECRET },
) {
  return request.post(WEBHOOK_URL, { data: payload, headers });
}

test.describe('Inbound email webhook', () => {
  test('valid payload creates a new open ticket with the first message', async ({ request }) => {
    const suffix = randomLetters(8);
    const payload: InboundEmailPayload = {
      from: `requester-${suffix}@e2e.test`,
      fromName: 'QA Requester',
      to: 'support@e2e.test',
      subject: `Help with my account ${suffix}`,
      text: `I need help with something, ref ${suffix}.`,
    };

    let ticketId: string | undefined;
    try {
      const response = await postInboundEmail(request, payload);
      expect(response.status()).toBe(201);

      const body = (await response.json()) as { ticket: Ticket };
      ticketId = body.ticket.id;

      expect(body.ticket.requesterEmail).toBe(payload.from);
      expect(body.ticket.subject).toBe(payload.subject);
      expect(body.ticket.status).toBe('open');
      expect(body.ticket.messages).toHaveLength(1);
      expect(body.ticket.messages[0].body).toBe(payload.text);
      expect(body.ticket.messages[0].fromEmail).toBe(payload.from);
    } finally {
      if (ticketId) await deleteTicket(ticketId);
    }
  });

  test('missing webhook secret header returns 401 and creates no ticket', async ({ request }) => {
    const suffix = randomLetters(8);
    const payload: InboundEmailPayload = {
      from: `requester-${suffix}@e2e.test`,
      to: 'support@e2e.test',
      subject: `No secret ${suffix}`,
      text: 'This should be rejected.',
    };

    const response = await postInboundEmail(request, payload, {});
    expect(response.status()).toBe(401);

    const tickets = await findTicketsByRequesterEmail(payload.from);
    expect(tickets).toHaveLength(0);
  });

  test('wrong webhook secret header returns 401 and creates no ticket', async ({ request }) => {
    const suffix = randomLetters(8);
    const payload: InboundEmailPayload = {
      from: `requester-${suffix}@e2e.test`,
      to: 'support@e2e.test',
      subject: `Wrong secret ${suffix}`,
      text: 'This should be rejected.',
    };

    const response = await postInboundEmail(request, payload, {
      'X-Webhook-Secret': 'definitely-the-wrong-secret',
    });
    expect(response.status()).toBe(401);

    const tickets = await findTicketsByRequesterEmail(payload.from);
    expect(tickets).toHaveLength(0);
  });

  test('payload missing a required field (subject) returns 400', async ({ request }) => {
    const suffix = randomLetters(8);
    const payload = {
      from: `requester-${suffix}@e2e.test`,
      to: 'support@e2e.test',
      text: 'Body with no subject.',
    };

    const response = await postInboundEmail(request, payload);
    expect(response.status()).toBe(400);

    const body = (await response.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });

  test('malformed from address returns 400', async ({ request }) => {
    const suffix = randomLetters(8);
    const payload: InboundEmailPayload = {
      from: 'not-an-email',
      to: 'support@e2e.test',
      subject: `Malformed from ${suffix}`,
      text: 'Body text.',
    };

    const response = await postInboundEmail(request, payload);
    expect(response.status()).toBe(400);
  });

  test('duplicate messageId is rejected with 409', async ({ request }) => {
    const suffix = randomLetters(8);
    const messageId = `msg-${suffix}@sender.example`;
    const payload: InboundEmailPayload = {
      from: `requester-${suffix}@e2e.test`,
      to: 'support@e2e.test',
      subject: `Duplicate message id ${suffix}`,
      text: 'First delivery.',
      messageId,
    };

    let ticketId: string | undefined;
    try {
      const first = await postInboundEmail(request, payload);
      expect(first.status()).toBe(201);
      const firstBody = (await first.json()) as { ticket: Ticket };
      ticketId = firstBody.ticket.id;

      const second = await postInboundEmail(request, { ...payload, text: 'Retried delivery.' });
      expect(second.status()).toBe(409);
    } finally {
      if (ticketId) await deleteTicket(ticketId);
    }
  });

  test('a reply with matching sender and subject is appended to the existing ticket', async ({
    request,
  }) => {
    const suffix = randomLetters(8);
    const from = `requester-${suffix}@e2e.test`;
    const subject = `Question about billing ${suffix}`;

    let ticketId: string | undefined;
    try {
      let firstTicketId = '';

      await test.step('initial email creates a ticket', async () => {
        const response = await postInboundEmail(request, {
          from,
          to: 'support@e2e.test',
          subject,
          text: 'Initial message.',
        });
        expect(response.status()).toBe(201);
        const body = (await response.json()) as { ticket: Ticket };
        firstTicketId = body.ticket.id;
        ticketId = firstTicketId;
        expect(body.ticket.messages).toHaveLength(1);
      });

      await test.step('reply with a "Re:" subject is appended to the same ticket', async () => {
        const response = await postInboundEmail(request, {
          from,
          to: 'support@e2e.test',
          subject: `Re: ${subject}`,
          text: 'Follow-up message.',
        });
        expect(response.status()).toBe(201);
        const body = (await response.json()) as { ticket: Ticket };

        expect(body.ticket.id).toBe(firstTicketId);
        expect(body.ticket.messages).toHaveLength(2);
        expect(body.ticket.messages.map((m) => m.body)).toEqual(
          expect.arrayContaining(['Initial message.', 'Follow-up message.']),
        );
      });
    } finally {
      if (ticketId) await deleteTicket(ticketId);
    }
  });

  test('a reply to a closed ticket creates a new ticket instead of reopening it', async ({
    request,
  }) => {
    const suffix = randomLetters(8);
    const from = `requester-${suffix}@e2e.test`;
    const subject = `Closed thread ${suffix}`;

    let firstTicketId: string | undefined;
    let secondTicketId: string | undefined;
    try {
      await test.step('initial email creates a ticket, which is then closed', async () => {
        const response = await postInboundEmail(request, {
          from,
          to: 'support@e2e.test',
          subject,
          text: 'Initial message.',
        });
        expect(response.status()).toBe(201);
        const body = (await response.json()) as { ticket: Ticket };
        firstTicketId = body.ticket.id;

        await closeTicket(firstTicketId);
      });

      await test.step('reply with matching sender and subject creates a fresh ticket', async () => {
        const response = await postInboundEmail(request, {
          from,
          to: 'support@e2e.test',
          subject: `Re: ${subject}`,
          text: 'Follow-up after close.',
        });
        expect(response.status()).toBe(201);
        const body = (await response.json()) as { ticket: Ticket };
        secondTicketId = body.ticket.id;

        expect(body.ticket.id).not.toBe(firstTicketId);
        expect(body.ticket.status).toBe('open');
        expect(body.ticket.messages).toHaveLength(1);
        expect(body.ticket.messages[0].body).toBe('Follow-up after close.');
      });
    } finally {
      if (firstTicketId) await deleteTicket(firstTicketId);
      if (secondTicketId) await deleteTicket(secondTicketId);
    }
  });
});
