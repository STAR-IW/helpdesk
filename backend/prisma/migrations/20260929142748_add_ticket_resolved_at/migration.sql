-- AlterTable
ALTER TABLE "ticket" ADD COLUMN     "resolvedAt" TIMESTAMP(3);


-- Backfill: existing resolved/closed tickets have no recorded resolution time, so
-- approximate it with their last update.
UPDATE "ticket" SET "resolvedAt" = "updatedAt" WHERE "status" IN ('resolved', 'closed');
