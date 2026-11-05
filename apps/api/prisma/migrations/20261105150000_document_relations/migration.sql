CREATE TYPE "DocumentRelationType" AS ENUM ('ATTACHMENT', 'TIMELINE', 'RECTIFICATION', 'RELATED');

CREATE TABLE "document_relations" (
    "id" UUID NOT NULL,
    "origin_document_id" UUID NOT NULL,
    "related_document_id" UUID NOT NULL,
    "relation_type" "DocumentRelationType" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_relations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "document_relations_distinct_documents_check" CHECK ("origin_document_id" <> "related_document_id")
);

CREATE UNIQUE INDEX "document_relations_pair_type_key"
    ON "document_relations"("origin_document_id", "related_document_id", "relation_type");

CREATE INDEX "document_relations_origin_created_idx"
    ON "document_relations"("origin_document_id", "created_at", "id");

CREATE INDEX "document_relations_target_type_created_idx"
    ON "document_relations"("related_document_id", "relation_type", "created_at");

ALTER TABLE "document_relations"
    ADD CONSTRAINT "document_relations_origin_document_id_fkey"
    FOREIGN KEY ("origin_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_relations"
    ADD CONSTRAINT "document_relations_related_document_id_fkey"
    FOREIGN KEY ("related_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
