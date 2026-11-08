CREATE TYPE "ProcessIngestionState" AS ENUM (
  'CANDIDATE',
  'FETCHED',
  'CLASSIFIED',
  'EXTRACTED',
  'NEEDS_REVIEW',
  'VERIFIED',
  'REJECTED',
  'SUPERSEDED'
);

ALTER TABLE "selection_processes"
  ADD COLUMN "ingestion_state" "ProcessIngestionState" NOT NULL DEFAULT 'CANDIDATE',
  ADD COLUMN "ingestion_state_reason" TEXT;

CREATE INDEX "processes_ingestion_state_created_idx"
  ON "selection_processes"("ingestion_state", "created_at", "id");
