# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ticket management system. See @project-scope.md for problem/features, @tech-stack.md for stack decisions, and @implementation-plan.md for phased build plan.

## Structure

Monorepo with three independent npm projects:
- `/backend` — Express + TypeScript API (ESM, `"type": "module"` in package.json)
- `/frontend` — React + TypeScript, built with Vite
- `/e2e` — Playwright end-to-end tests, driving `/frontend` against `/backend` run with a fully self-contained test environment (own database, `BETTER_AUTH_SECRET`, admin account — independent from the root `.env`)

## Commands

Backend (`cd backend`):
- `npm run dev` — run with `tsx watch` (auto-reload)
- `npm run build` — compile with `tsc`
- `npm start` — run compiled output from `dist/`
- `npm run lint` — ESLint (flat config, `eslint.config.js`)

Frontend (`cd frontend`):
- `npm run dev` — Vite dev server
- `npm run build` — production build

E2E (`cd e2e`):
- `npm test` — run the Playwright suite (starts `/backend` and `/frontend` dev servers itself via `webServer`)
- One-time setup: `cp e2e/.env.example e2e/.env`, generate a fresh `BETTER_AUTH_SECRET` (e.g. `openssl rand -base64 32`), and point `DATABASE_URL` at a separate Postgres database (e.g. `helpdesk_test`, must exist already — create it once with `createdb helpdesk_test` or equivalent). `e2e/.env` is intentionally fully self-contained — its own secret, admin email/password, database — independent of the root `.env`, so e2e runs never share state (or credentials) with dev. Every run resets the test database from scratch (`prisma migrate reset --force` in both `global-setup.ts` and `global-teardown.ts`) — **never point `e2e/.env` at the same database as the root `.env`**, it will be wiped.

## Architecture notes

- Auth uses database-backed sessions (session id in an HTTP-only cookie, session record in Postgres) — not JWT. This is intentional, to allow server-side session revocation.
- AI features (ticket classification, auto-response, summaries, suggested replies) call the Anthropic API server-side only, from the backend — never from the frontend.
- Frontend and backend are separate processes/origins; backend has `cors()` enabled for local cross-origin requests.
- Frontend UI components use shadcn/ui (`base-nova` style, `neutral` base color, Base UI primitives, Tailwind v4 CSS-based theming — no `tailwind.config.js`). Config lives in `frontend/components.json`; theme tokens/colors are in `frontend/src/index.css`.
- `@/*` resolves to `frontend/src/*` (path alias set in `tsconfig.json`, `tsconfig.app.json`, and `vite.config.ts`).
- To add more shadcn components: `cd frontend && npx shadcn@latest add <component>`.
- better-auth's rate limiter is enabled only when `NODE_ENV=production` (`backend/src/auth.ts`, gated via `backend/src/env.ts`'s `NODE_ENV`) — an explicit, deliberate gate, not a library default being relied on. Sign-in is unthrottled in development and test; remember to set `NODE_ENV=production` on deploy.

## Gotchas

- Backend's `typescript` is pinned to `~6.0.2` (matching frontend), not the latest major — `typescript-eslint` doesn't support TypeScript 7 yet (peer range `<6.1.0`). Don't bump either project's TypeScript past that range without checking `typescript-eslint`'s peer support first.
- Always run `npm install` from inside `/frontend`, `/backend`, or `/e2e`, never from the repo root — the repo root has no `package.json` of its own.
- `e2e/global-setup.ts` and `e2e/global-teardown.ts` run `prisma migrate reset --force` (drops and recreates the schema) against whatever `DATABASE_URL` is in `e2e/.env` — that file must always point at a disposable database, never the dev one.

## Working with libraries/frameworks

Use the context7 MCP tool to fetch up-to-date documentation when implementing against a library or framework (Express, React, Vite, Prisma, etc.) instead of relying on memory — APIs and recommended setup change between versions.