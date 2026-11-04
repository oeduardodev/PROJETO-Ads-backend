-- Persist the cursor separately from last_checked_at, which tracks source refresh scheduling.
ALTER TABLE "sources"
  ADD COLUMN "discovery_cursor" JSONB,
  ADD COLUMN "strategy_last_executed_at" TIMESTAMPTZ(6);
