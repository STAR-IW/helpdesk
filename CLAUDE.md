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
- AI features (ticket classification, auto-response, summaries, suggested replies, reply polish) go through the Vercel AI SDK (`ai` + a provider package, e.g. `@ai-sdk/google`), called server-side only from the backend — never from the frontend. The model/provider is chosen in one place (`backend/src/ai/client.ts`, currently Gemini's `gemini-3.5-flash`) so it can be swapped later without touching call sites; add new AI features under `backend/src/ai/` following the same pattern (e.g. `polish-reply.ts`).
- Frontend and backend are separate processes/origins; backend has `cors()` enabled for local cross-origin requests.
- Frontend UI components use shadcn/ui (`base-nova` style, `neutral` base color, Base UI primitives, Tailwind v4 CSS-based theming — no `tailwind.config.js`). Config lives in `frontend/components.json`; theme tokens/colors are in `frontend/src/index.css`.
- `@/*` resolves to `frontend/src/*` (path alias set in `tsconfig.json`, `tsconfig.app.json`, and `vite.config.ts`).
- To add more shadcn components: `cd frontend && npx shadcn@latest add <component>`.
- better-auth's rate limiter is enabled only when `NODE_ENV=production` (`backend/src/auth.ts`, gated via `backend/src/env.ts`'s `NODE_ENV`) — an explicit, deliberate gate, not a library default being relied on. Sign-in is unthrottled in development and test; remember to set `NODE_ENV=production` on deploy.
- Use zod for data validation, on both sides: backend routes validate `req.body` with a `zod` schema and `safeParse` (see `backend/src/routes/users.ts`'s `createUserSchema`), and frontend forms validate with a `zod` schema via `@hookform/resolvers/zod`'s `zodResolver` (see `frontend/src/pages/LoginPage.tsx`). `zod` is already a dependency in both `/backend` and `/frontend` — don't reach for another validation library.
- User `role` is `admin` | `agent` (defined in `backend/prisma/schema.prisma`'s `Role` enum). Never compare or assign it with raw string literals — backend code imports and uses the generated `Role` enum from `backend/src/generated/prisma/enums.js` (e.g. `Role.admin`, `Role.agent`); frontend code can't import that generated file (separate npm project), so it uses the `Role` type alias exported from `frontend/src/constants/role.ts` instead. Any new file that reads or checks a user's role should import one of these rather than writing `'admin'`/`'agent'` inline.
- `frontend/src/constants/` holds the frontend's shared domain types and label/enum-style constants — the reusable vocabulary that multiple components/pages need for the same entity (`ticket.ts`'s `Ticket`/`TicketDetail`/`TicketMessage`, `agent.ts`'s `Agent`, `reply.ts`'s `Reply`, `role.ts`'s `Role`, plus the label maps `ticket-status.ts`, `ticket-category.ts`, `reply-sender-type.ts`). Before adding a new type or a `*_LABELS`-style map for something ticket/user/reply-shaped, check here first and extend or import the existing one rather than redeclaring an inline `type Foo = {...}` in a component — that's how the same shape used to end up duplicated across `TicketsTable.tsx`, `TicketDetails.tsx`, and `ReplyThread.tsx`. `frontend/src/lib/` stays reserved for infrastructure/utilities (the `apiGet`/`apiPost`/`ApiError` HTTP client, the better-auth client, `cn()`) rather than domain types. Narrower single-component prop types (e.g. `TicketDetailsProps`) stay local; only entity shapes and constants shared across files belong in `constants/`.

## Gotchas

- Backend's `typescript` is pinned to `~6.0.2` (matching frontend), not the latest major — `typescript-eslint` doesn't support TypeScript 7 yet (peer range `<6.1.0`). Don't bump either project's TypeScript past that range without checking `typescript-eslint`'s peer support first.
- Always run `npm install` from inside `/frontend`, `/backend`, or `/e2e`, never from the repo root — the repo root has no `package.json` of its own.
- `/e2e` runs its backend/frontend on dedicated ports — `3001`/`5174` (`e2e/.env`'s `PORT`/`FRONTEND_URL`/`VITE_API_URL`, wired through `e2e/playwright.config.ts`) — deliberately different from the dev defaults (`3000`/`5173`). Never manually start a dev server (`npm run dev` in `/backend` or `/frontend`) on `3001`/`5174`, and never point `e2e/.env`'s `DATABASE_URL` at the dev database. If a dev server happens to already be running on the *dev* ports when e2e tests run, that's fine — they no longer collide. This separation exists because Playwright's `reuseExistingServer: true` will silently reuse whatever's already listening on a port instead of starting its own — previously this meant a leftover dev backend (wired to the dev DB) got reused by e2e runs, so tests silently authenticated against real dev data instead of the freshly-seeded `helpdesk_test` database.

## e2e tests

- Never manually run `npx prisma migrate reset` (or anything destructive) against a database without confirming the target and getting explicit user consent first — `e2e/global-setup.ts`/`global-teardown.ts` already do this against `helpdesk_test` on every e2e run, which is expected, but always verify `DATABASE_URL` at the time before assuming any reset is safe.
- Keep the e2e suite minimal: only add an e2e test for something a mocked-API frontend component/page test genuinely cannot prove. That's real cross-process behavior — a PATCH/POST actually persisting through the backend into Postgres (verified via a reload, not just an in-memory refetch), role gating driven by a real logged-in session rather than a mocked `useSession`, real email-webhook ticket intake, cross-page navigation that depends on server state, and the like. Rendering logic, form validation, mutation-call arguments, loading/empty/error states, and anything else provable by mocking `@/lib/api` belong in a frontend component test (see Component tests above), not in `/e2e` — don't duplicate coverage across both layers. When updating an existing page/component's frontend tests, check whether any e2e test for the same page became redundant and trim it.

## Working with libraries/frameworks

Use the context7 MCP tool to fetch up-to-date documentation when implementing against a library or framework (Express, React, Vite, Prisma, etc.) instead of relying on memory — APIs and recommended setup change between versions.