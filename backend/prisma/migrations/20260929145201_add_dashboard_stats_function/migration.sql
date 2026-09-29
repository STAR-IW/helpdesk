-- Computes everything the dashboard shows in a single round trip. Returns the exact
-- JSON body of GET /api/dashboard/stats:
--   { stats: { totalTickets, openTickets, aiResolvedTickets, aiResolvedPercent,
--              avgResolutionSeconds }, ticketsPerDay: [{ date, count }] }
-- ai_agent_id is the AI agent user's id (NULL when it hasn't been seeded, in which case
-- nothing counts as AI-resolved).
CREATE OR REPLACE FUNCTION dashboard_stats(ai_agent_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  WITH totals AS (
    SELECT
      COUNT(*)::int AS total_tickets,
      (COUNT(*) FILTER (WHERE "status" = 'open'))::int AS open_tickets,
      -- A ticket still assigned to the AI agent after resolving was resolved by the AI;
      -- anything it couldn't resolve (or that was reopened) is unassigned from it.
      (COUNT(*) FILTER (
        WHERE "assignedAgentId" = ai_agent_id AND "status" IN ('resolved', 'closed')
      ))::int AS ai_resolved_tickets,
      -- AVG skips tickets without a resolvedAt.
      ROUND(AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt"))))::bigint AS avg_resolution_seconds
    FROM "ticket"
  ),
  -- One row per UTC day for the last 30 days (today included), zero-filled so days
  -- without tickets still appear.
  per_day AS (
    SELECT d.day, COUNT(t.id)::int AS count
    FROM generate_series(
      (now() AT TIME ZONE 'UTC')::date - 29,
      (now() AT TIME ZONE 'UTC')::date,
      interval '1 day'
    ) AS d(day)
    LEFT JOIN "ticket" t ON t."createdAt"::date = d.day::date
    GROUP BY d.day
  )
  SELECT jsonb_build_object(
    'stats', jsonb_build_object(
      'totalTickets', t.total_tickets,
      'openTickets', t.open_tickets,
      'aiResolvedTickets', t.ai_resolved_tickets,
      'aiResolvedPercent', CASE
        WHEN t.total_tickets = 0 THEN 0
        ELSE ROUND(t.ai_resolved_tickets * 100.0 / t.total_tickets, 1)
      END,
      'avgResolutionSeconds', t.avg_resolution_seconds
    ),
    'ticketsPerDay', (
      SELECT jsonb_agg(
        jsonb_build_object('date', to_char(p.day, 'YYYY-MM-DD'), 'count', p.count)
        ORDER BY p.day
      )
      FROM per_day p
    )
  )
  FROM totals t;
$$;
