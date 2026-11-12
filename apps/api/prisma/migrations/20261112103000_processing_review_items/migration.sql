CREATE TYPE "DocumentProcessingReviewStatus" AS ENUM ('OPEN', 'RESOLVED');

CREATE TABLE "document_processing_review_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "discovered_url_id" UUID,
    "status" "DocumentProcessingReviewStatus" NOT NULL DEFAULT 'OPEN',
    "process_id" UUID,
    "review_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by_admin_user_id" UUID,

    CONSTRAINT "document_processing_review_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_processing_review_items_document_hash_key"
  ON "document_processing_review_items"("document_id", "sha256");
CREATE INDEX "document_processing_review_items_process_idx"
  ON "document_processing_review_items"("process_id");
CREATE INDEX "document_processing_review_items_status_created_idx"
  ON "document_processing_review_items"("status", "created_at", "id");
CREATE INDEX "document_processing_review_items_candidate_idx"
  ON "document_processing_review_items"("discovered_url_id");

ALTER TABLE "document_processing_review_items"
  ADD CONSTRAINT "document_processing_review_items_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_processing_review_items"
  ADD CONSTRAINT "document_processing_review_items_discovered_url_id_fkey"
  FOREIGN KEY ("discovered_url_id") REFERENCES "discovered_urls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_processing_review_items"
  ADD CONSTRAINT "document_processing_review_items_process_id_fkey"
  FOREIGN KEY ("process_id") REFERENCES "selection_processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_processing_review_items"
  ADD CONSTRAINT "document_processing_review_items_resolved_by_admin_user_id_fkey"
  FOREIGN KEY ("resolved_by_admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
