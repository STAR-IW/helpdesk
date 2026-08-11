# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ticket management system. See @project-scope.md for problem/features, @tech-stack.md for stack decisions, and @implementation-plan.md for phased build plan.

## Structure

Monorepo with three independent npm projects:
- `/backend` — Express + TypeScript API (ESM, `"type": "module"` in package.json)
- `/frontend` — React + TypeScript, built with Vite
- `/e2e` — Playwright end-to-end tests, driving `/frontend` against `/backend`. Use the `e2e-test-writer` subagent whenever writing or updating e2e tests — it has the setup, running, and test-writing conventions; don't write `/e2e` test files directly.

## Commands

Backend (`cd backend`):
- `npm run dev` — run with `tsx watch` (auto-reload)
- `npm run build` — compile with `tsc`
- `npm start` — run compiled output from `dist/`
- `npm run lint` — ESLint (flat config, `eslint.config.js`)

Frontend (`cd frontend`):
- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm test` — run component tests (`vitest run`)

## Component tests (frontend)

Vitest + React Testing Library, `jsdom` environment (configured in `frontend/vite.config.ts`'s `test` block). Global setup is `frontend/src/test/setup.ts` — it registers jest-dom matchers and calls `cleanup()` after every test; don't re-do that in individual test files.

- Colocate tests next to the component/page: `Thing.tsx` → `Thing.test.tsx` in the same directory.
- Render with `renderWithProviders` from `@/test/render`, not RTL's `render` directly — it wraps the tree in a `QueryClientProvider` (with `retry: false`) so components using TanStack Query work in tests without real retry delays.
- Query through `screen`/`within` by role or text, the way a user would find the element. Use `findBy*` for content that appears after an async state change (e.g. a query resolving), `queryBy*` when asserting something is absent, `getBy*` for content that should already be there.
- Mock child components that aren't the thing under test with `vi.mock('@/components/Whatever', () => ({ Whatever: () => null }))` to isolate the unit and avoid unrelated rendering errors.
- Mock `@/lib/api` with `vi.importActual` and override just the methods you need (`apiGet`, `apiPost`, etc.), then get a typed handle via `vi.mocked(apiGet)`. Reset mocks in `beforeEach` (`mockedApiGet.mockReset()`).
- Cover the states a component can actually be in: loading, populated, empty, and error (both a thrown `ApiError` with a server message, and an unexpected/generic error) — see `frontend/src/pages/UsersPage.test.tsx` as the reference example.
- Run a single file during iteration with `npm test -- src/pages/UsersPage.test.tsx` (from `/frontend`); run the full suite with `npm test` before considering component work done.
- These are component/unit tests, not end-to-end flows — for anything that needs a real backend or crosses pages, use the `e2e-test-writer` subagent instead (see Structure above).

## Architecture notes

- Auth uses database-backed sessions (session id in an HTTP-only cookie, session record in Postgres) — not JWT. This is intentional, to allow server-side session revocation.
- AI features (ticket classification, auto-response, summaries, suggested replies) call the Anthropic API server-side only, from the backend — never from the frontend.
- Frontend and backend are separate processes/origins; backend has `cors()` enabled for local cross-origin requests.
- Frontend UI components use shadcn/ui (`base-nova` style, `neutral` base color, Base UI primitives, Tailwind v4 CSS-based theming — no `tailwind.config.js`). Config lives in `frontend/components.json`; theme tokens/colors are in `frontend/src/index.css`.
- `@/*` resolves to `frontend/src/*` (path alias set in `tsconfig.json`, `tsconfig.app.json`, and `vite.config.ts`).
- To add more shadcn components: `cd frontend && npx shadcn@latest add <component>`.
- better-auth's rate limiter is enabled only when `NODE_ENV=production` (`backend/src/auth.ts`, gated via `backend/src/env.ts`'s `NODE_ENV`) — an explicit, deliberate gate, not a library default being relied on. Sign-in is unthrottled in development and test; remember to set `NODE_ENV=production` on deploy.
- Use zod for data validation, on both sides: backend routes validate `req.body` with a `zod` schema and `safeParse` (see `backend/src/routes/users.ts`'s `createUserSchema`), and frontend forms validate with a `zod` schema via `@hookform/resolvers/zod`'s `zodResolver` (see `frontend/src/pages/LoginPage.tsx`). `zod` is already a dependency in both `/backend` and `/frontend` — don't reach for another validation library.

## Gotchas

- Backend's `typescript` is pinned to `~6.0.2` (matching frontend), not the latest major — `typescript-eslint` doesn't support TypeScript 7 yet (peer range `<6.1.0`). Don't bump either project's TypeScript past that range without checking `typescript-eslint`'s peer support first.
- Always run `npm install` from inside `/frontend`, `/backend`, or `/e2e`, never from the repo root — the repo root has no `package.json` of its own.

## Working with libraries/frameworks

Use the context7 MCP tool to fetch up-to-date documentation when implementing against a library or framework (Express, React, Vite, Prisma, etc.) instead of relying on memory — APIs and recommended setup change between versions.