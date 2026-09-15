# Tech Stack

## Backend
Node.js + Express.js (TypeScript)

## Frontend
React + React Router (TypeScript, Vite)
Tailwind CSS

## Authentication
Database-backed sessions (not JWT).
- Session id stored in an HTTP-only cookie
- Session records stored in Postgres (e.g. via connect-pg-simple or a custom sessions table)
- Enables server-side session revocation (e.g. admin force-logout of an agent)

## Database
PostgreSQL + Prisma (ORM)

## Email Intake
Inbound email webhook (Postmark Inbound / SendGrid Inbound Parse / Mailgun Routes) → Express endpoint
- Converts incoming support emails into ticket-creation events
- Avoids running an IMAP poller

## AI
Vercel AI SDK (`ai` + `@ai-sdk/google`), called server-side only from `/backend`.
- Currently configured against Gemini (`gemini-3.5-flash`) — the AI SDK's unified provider
  interface was chosen specifically so the underlying model/provider (e.g. Anthropic, OpenAI)
  can be swapped later by changing the provider in `backend/src/ai/client.ts`, without
  rewriting call sites.
- Ticket classification (structured output into: general question, technical question, refund request)
- Auto-response generation from knowledge base
- Ticket summaries
- AI-suggested replies / message polish

## Background Jobs
Deferred until volume requires it. Start with synchronous processing in the webhook handler; introduce a queue (BullMQ + Redis) later if LLM calls or email volume start blocking request handling.

## Hosting
- Frontend: static hosting (e.g. Vercel, Netlify, or served by Express)
- Backend: Render / Railway (Express app + Postgres)