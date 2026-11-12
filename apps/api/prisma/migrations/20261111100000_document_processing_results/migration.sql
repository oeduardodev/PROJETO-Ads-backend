CREATE TYPE "DocumentProcessorKind" AS ENUM ('CLASSIFICATION', 'EXTRACTION');

CREATE TABLE "document_processing_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_id" UUID NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "processor_kind" "DocumentProcessorKind" NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "result_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_processing_results_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_processing_results_schema_version_check" CHECK ("schema_version" > 0),
    CONSTRAINT "document_processing_results_status_check" CHECK ("status" IN ('COMPLETED', 'PENDING_REVIEW', 'EXCLUDED')),
    CONSTRAINT "document_processing_results_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "document_processing_results_identity_key" ON "document_processing_results"("document_id", "sha256", "processor_kind", "schema_version");
CREATE INDEX "document_processing_results_kind_status_idx" ON "document_processing_results"("processor_kind", "status", "created_at");
