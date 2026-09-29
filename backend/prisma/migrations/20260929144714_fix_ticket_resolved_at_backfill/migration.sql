-- The previous migration backfilled "resolvedAt" from "updatedAt", which also moves on
-- any later edit (e.g. bulk updates), inflating resolution times. Re-derive it from the
-- ticket's last reply instead — every resolved/closed ticket has one.
UPDATE "ticket" t
SET "resolvedAt" = r.last_reply
FROM (SELECT "ticketId", MAX("createdAt") AS last_reply FROM "reply" GROUP BY "ticketId") r
WHERE r."ticketId" = t.id
  AND t."resolvedAt" IS NOT NULL;
