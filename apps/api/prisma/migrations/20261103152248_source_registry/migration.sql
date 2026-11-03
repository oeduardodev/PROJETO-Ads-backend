-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('HTML_INDEX', 'SITEMAP', 'RSS');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "SourceHealth" AS ENUM ('UNKNOWN', 'HEALTHY', 'DEGRADED', 'BLOCKED');

-- CreateTable
CREATE TABLE "allowed_domains" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "host" VARCHAR(253) NOT NULL,
    "evidence_url" TEXT NOT NULL,
    "reviewed_at" TIMESTAMPTZ(6),
    "collection_allowed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "allowed_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "allowed_domain_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "selector" TEXT,
    "frequency_minutes" INTEGER NOT NULL DEFAULT 1440,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "status" "SourceStatus" NOT NULL DEFAULT 'DRAFT',
    "health" "SourceHealth" NOT NULL DEFAULT 'UNKNOWN',
    "last_checked_at" TIMESTAMPTZ(6),
    "last_success_at" TIMESTAMPTZ(6),
    "etag" VARCHAR(512),
    "last_modified" VARCHAR(128),

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "allowed_domains_institution_host_key" ON "allowed_domains"("institution_id", "host");

-- CreateIndex
CREATE UNIQUE INDEX "allowed_domains_id_institution_key" ON "allowed_domains"("id", "institution_id");

-- CreateIndex
CREATE INDEX "sources_status_priority_idx" ON "sources"("status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "sources_institution_url_key" ON "sources"("institution_id", "url");

-- AddForeignKey
ALTER TABLE "allowed_domains" ADD CONSTRAINT "allowed_domains_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_allowed_domain_id_institution_id_fkey" FOREIGN KEY ("allowed_domain_id", "institution_id") REFERENCES "allowed_domains"("id", "institution_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sources" ADD CONSTRAINT "sources_frequency_positive_check" CHECK ("frequency_minutes" > 0);
ALTER TABLE "sources" ADD CONSTRAINT "sources_priority_nonnegative_check" CHECK ("priority" >= 0);
ALTER TABLE "allowed_domains" ADD CONSTRAINT "allowed_domains_review_before_collection_check" CHECK (NOT "collection_allowed" OR "reviewed_at" IS NOT NULL);
