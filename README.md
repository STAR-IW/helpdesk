# Helpdesk

An AI-assisted support desk: inbound support emails become tickets, which an AI pipeline classifies and, when the knowledge base fully covers them, answers automatically.
Everything else goes to a human agent queue, where agents get AI summaries and reply polishing.

## Stack

- **Backend:** Node.js, Express 5, TypeScript, Prisma 7, PostgreSQL
- **Jobs:** pg-boss (a Postgres-backed queue)
- **AI:** Vercel AI SDK (`ai` + `@ai-sdk/google`, Gemini), server-side only
- **Auth:** better-auth with database-backed sessions in an HTTP-only cookie
- **Frontend:** React, Vite, React Router, TanStack Query, Tailwind v4, shadcn/ui
- **Validation:** zod on both sides
- **Tests:** Vitest (backend + frontend components), Playwright (`/e2e`)

## Architecture

```
 email provider ──POST /api/webhooks/──▶ ┌──────────────── Express API ────────────────┐
                                          │  one transaction:                           │
 React SPA ──REST + session cookie──────▶ │    INSERT ticket + message                  │
                                          │    INSERT pg-boss job                       │
                                          └───────────────┬─────────────────────────────┘
                                                          │
                                                          ▼
                                          ┌────────────── PostgreSQL ───────────────────┐
                                          │  tickets · messages · users · sessions      │
                                          │  pgboss.job  (the queue lives here too)     │
                                          └───────────────┬─────────────────────────────┘
                                                          │ worker polls
                                                          ▼
                                   pg-boss worker: new → processing → classify
                                     ├─ KB answers it  → AI reply, status = resolved
                                     └─ otherwise      → status = open, human queue
```

The repo has three independent npm projects: `/backend`, `/frontend` and `/e2e`. Run `npm install` inside each one. See `CLAUDE.md` for commands and conventions.

## Key design decisions

**The AI job is enqueued in the same transaction as the ticket.**
The inbound-email handler creates the ticket and calls `boss.send(..., { db: fromPrisma(tx) })` inside one `prisma.$transaction` (`backend/src/routes/inbound-email.ts`, `backend/src/jobs/process-ticket-job.ts`). They commit together or not at all. If the enqueue fails, the ticket rolls back and the webhook returns 500, so the email provider retries. Without this, a ticket could be saved with no job to process it and stay stuck in `new`. Duplicate jobs are harmless: each status change is a guarded `updateMany` (for example `where status = new`), so a second run does nothing and never overwrites an agent's manual change.

**Why pg-boss.**
The queue lives in the same Postgres database as the app. That is what allows the transactional enqueue above, which a Redis-backed queue such as BullMQ cannot do. It also means there is no extra service to host or monitor. pg-boss provides retries with backoff (`retryLimit: 3`) at the volume this app handles. Webhook requests return right away instead of waiting on LLM calls.

**Model output is treated as untrusted.**
- **Structured output wherever a value drives logic.** Classification uses `Output.choice` over the Prisma `TicketCategory` enum. Follow-up triage uses `Output.choice` between `acknowledgement` and `needsResponse`. Auto-resolve uses `Output.object` with a zod schema (`{ canResolve, reply }`). Code never parses free text to decide a status.
- **Failing safe.** If classification fails, the ticket stays uncategorized. If auto-resolve fails or returns an empty reply, the ticket goes to the human queue. If the follow-up check fails, the ticket is reopened. AI errors never leave a ticket hidden in `new` or `processing`.
- **Plain text only.** AI replies are stored and rendered as plain text, never as HTML. The only HTML the app renders is from inbound email, and it is sanitized with DOMPurify on the server and again in the browser.
- **Humans stay in the loop.** Summaries and polished replies go back to the agent to review and edit, not straight to the customer. AI calls run only on the backend, so the provider key never reaches the browser.
