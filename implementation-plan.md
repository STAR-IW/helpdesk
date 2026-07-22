# Implementation Plan

## Phase 1 — Foundations
- [ ] Set up monorepo structure: `/backend` (Express, TypeScript), `/frontend` (React app with TypeScript )
- [ ] Set up Postgres Database


## Phase 2 — Ticket Core (no AI yet)
- [ ] Ticket creation API (manual, for testing before email intake exists)
- [ ] Ticket list API with filter (status, category, assigned agent) and sort
- [ ] Ticket detail API (message thread)
- [ ] Agent reply endpoint (manual reply, updates ticket status)
- [ ] Frontend: ticket list page (table with filter/sort controls)
- [ ] Frontend: ticket detail view page (thread + reply box)

## Phase 3 — Email Intake
- [ ] Pick inbound email provider (Postmark Inbound / SendGrid Inbound Parse / Mailgun Routes) and configure inbound domain/route
- [ ] Webhook endpoint: parse inbound email payload → create ticket + first message
- [ ] Thread matching: route a reply email to its existing ticket instead of creating a new one
- [ ] Error handling/logging for malformed or unexpected payloads

## Phase 4 — AI Ticket Classification
- [ ] Anthropic API client wrapper (server-side only, key via env config)
- [ ] Classification prompt with structured output: general question / technical question / refund request
- [ ] Auto-assign category on ticket creation; display in UI
- [ ] Allow agent to manually override the assigned category

## Phase 5 — Knowledge Base & Auto-Response
- [ ] KnowledgeBaseArticle data model + admin CRUD UI
- [ ] Retrieval step: match ticket to a KB article (start with keyword match, revisit for semantic search later)
- [ ] Auto-response generation: draft a reply from the matched KB article via Claude
- [ ] Escalation rule: no confident KB match → route to agent queue instead of auto-responding
- [ ] Decide and implement send behavior: auto-send vs. draft-for-agent-review (open decision from scope review)
- [ ] Auto-update ticket status when an auto-response is sent

## Phase 6 — Agent AI Assist Tools
- [ ] AI-suggested reply endpoint (draft reply for agent to edit, for non-KB tickets)
- [ ] AI summary endpoint (summarize a long ticket thread)
- [ ] Message polish endpoint (agent drafts, AI rewrites tone/clarity)
- [ ] Frontend: wire suggested-reply / summary / polish actions into the ticket detail view

## Phase 7 — Admin & User Management
- [ ] Admin UI: list agents, create new agent account
- [ ] Admin UI: deactivate agent account, force-logout (revoke session)
- [ ] Role-based route guards for admin-only pages

## Phase 8 — Dashboard & Polish
- [ ] Dashboard summary view (ticket counts by status/category)
- [ ] Pagination for ticket list
- [ ] Empty/loading/error states across the UI
- [ ] Basic test coverage: auth, ticket flow, AI classification
- [ ] Deploy: backend (Render/Railway) + Postgres, frontend static hosting, env config

