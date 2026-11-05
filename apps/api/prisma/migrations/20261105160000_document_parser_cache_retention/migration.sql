CREATE TYPE "DocumentParserKind" AS ENUM ('HTML_DOCUMENT', 'PDF_TEXT', 'OCR');

ALTER TABLE "sources"
    ADD COLUMN "snapshot_retention_days" INTEGER,
    ADD COLUMN "retention_reviewed_at" TIMESTAMPTZ(6);

ALTER TABLE "sources"
    ADD CONSTRAINT "sources_snapshot_retention_policy_check"
    CHECK (
        ("snapshot_retention_days" IS NULL AND "retention_reviewed_at" IS NULL)
        OR (
            "snapshot_retention_days" IS NOT NULL
            AND "snapshot_retention_days" > 0
            AND "retention_reviewed_at" IS NOT NULL
        )
    );

ALTER TABLE "document_blobs"
    ADD COLUMN "expired_at" TIMESTAMPTZ(6);

CREATE INDEX "document_blobs_expired_at_idx" ON "document_blobs"("expired_at");

CREATE TABLE "document_parse_cache" (
    "sha256" CHAR(64) NOT NULL,
    "parser_kind" "DocumentParserKind" NOT NULL,
    "parser_version" INTEGER NOT NULL,
    "result_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_parse_cache_pkey" PRIMARY KEY ("sha256", "parser_kind", "parser_version")
);

CREATE INDEX "document_parse_cache_created_idx" ON "document_parse_cache"("created_at");

ALTER TABLE "document_parse_cache"
    ADD CONSTRAINT "document_parse_cache_sha256_fkey"
    FOREIGN KEY ("sha256") REFERENCES "document_blobs"("sha256") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_parse_cache"
    ADD CONSTRAINT "document_parse_cache_parser_version_check"
    CHECK ("parser_version" > 0);
