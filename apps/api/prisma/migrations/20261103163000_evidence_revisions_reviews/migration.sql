-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('RASCUNHO', 'EM_REVISAO', 'PUBLICADO', 'OCULTO', 'ARQUIVADO');

-- AlterTable
ALTER TABLE "selection_processes" ADD COLUMN     "publication_status" "PublicationStatus" NOT NULL DEFAULT 'RASCUNHO';

-- CreateTable
CREATE TABLE "evidence" (
    "id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "field_path" VARCHAR(250) NOT NULL,
    "page_or_section" VARCHAR(150),
    "quote" TEXT NOT NULL,
    "checked_at" TIMESTAMPTZ(6),

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisions" (
    "id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "changed_fields_json" JSONB NOT NULL,
    "supersedes_id" UUID,
    "detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_decisions" (
    "id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "reviewer_id" VARCHAR(128) NOT NULL,
    "decision" VARCHAR(64) NOT NULL,
    "reason" TEXT NOT NULL,
    "reviewed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evidence_process_field_idx" ON "evidence"("process_id", "field_path");

-- CreateIndex
CREATE INDEX "evidence_document_idx" ON "evidence"("document_id");

-- CreateIndex
CREATE INDEX "revisions_process_detected_idx" ON "revisions"("process_id", "detected_at");

-- CreateIndex
CREATE UNIQUE INDEX "revisions_id_process_key" ON "revisions"("id", "process_id");

-- CreateIndex
CREATE UNIQUE INDEX "revisions_supersedes_key" ON "revisions"("supersedes_id");

-- CreateIndex
CREATE INDEX "review_decisions_process_reviewed_idx" ON "review_decisions"("process_id", "reviewed_at");

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "selection_processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "selection_processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_supersedes_id_process_id_fkey" FOREIGN KEY ("supersedes_id", "process_id") REFERENCES "revisions"("id", "process_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "selection_processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "evidence" ADD CONSTRAINT "evidence_nonblank_check" CHECK (length(btrim("field_path")) > 0 AND length(btrim("quote")) > 0);
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_distinct_predecessor_check" CHECK ("supersedes_id" IS NULL OR "supersedes_id" <> "id");
ALTER TABLE "review_decisions" ADD CONSTRAINT "review_decisions_nonblank_check" CHECK (length(btrim("reviewer_id")) > 0 AND length(btrim("decision")) > 0 AND length(btrim("reason")) > 0);

CREATE FUNCTION reject_review_history_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Review history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER evidence_append_only BEFORE UPDATE OR DELETE ON "evidence"
FOR EACH ROW EXECUTE FUNCTION reject_review_history_mutation();
CREATE TRIGGER revisions_append_only BEFORE UPDATE OR DELETE ON "revisions"
FOR EACH ROW EXECUTE FUNCTION reject_review_history_mutation();
CREATE TRIGGER review_decisions_append_only BEFORE UPDATE OR DELETE ON "review_decisions"
FOR EACH ROW EXECUTE FUNCTION reject_review_history_mutation();
