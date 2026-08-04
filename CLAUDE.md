# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ticket management system. See @project-scope.md for problem/features, @tech-stack.md for stack decisions, and @implementation-plan.md for phased build plan.

## Structure

Monorepo with two independent npm projects:
- `/backend` — Express + TypeScript API (ESM, `"type": "module"` in package.json)
- `/frontend` — React + TypeScript, built with Vite

## Commands

Backend (`cd backend`):
- `npm run dev` — run with `tsx watch` (auto-reload)
- `npm run build` — compile with `tsc`
- `npm start` — run compiled output from `dist/`
- `npm run lint` — ESLint (flat config, `eslint.config.js`)

Frontend (`cd frontend`):
- `npm run dev` — Vite dev server
- `npm run build` — production build

## Architecture notes

- Auth uses database-backed sessions (session id in an HTTP-only cookie, session record in Postgres) — not JWT. This is intentional, to allow server-side session revocation.
- AI features (ticket classification, auto-response, summaries, suggested replies) call the Anthropic API server-side only, from the backend — never from the frontend.
- Frontend and backend are separate processes/origins; backend has `cors()` enabled for local cross-origin requests.
- Frontend UI components use shadcn/ui (`base-nova` style, `neutral` base color, Base UI primitives, Tailwind v4 CSS-based theming — no `tailwind.config.js`). Config lives in `frontend/components.json`; theme tokens/colors are in `frontend/src/index.css`.
- `@/*` resolves to `frontend/src/*` (path alias set in `tsconfig.json`, `tsconfig.app.json`, and `vite.config.ts`).
- To add more shadcn components: `cd frontend && npx shadcn@latest add <component>`.

## Gotchas

- Backend's `typescript` is pinned to `~6.0.2` (matching frontend), not the latest major — `typescript-eslint` doesn't support TypeScript 7 yet (peer range `<6.1.0`). Don't bump either project's TypeScript past that range without checking `typescript-eslint`'s peer support first.
- Always run `npm install` from inside `/frontend` or `/backend`, never from the repo root — the repo root has no `package.json` of its own. 

## Working with libraries/frameworks

Use the context7 MCP tool to fetch up-to-date documentation when implementing against a library or framework (Express, React, Vite, Prisma, etc.) instead of relying on memory — APIs and recommended setup change between versions.