-- CreateEnum
CREATE TYPE "CrawlRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "CrawlErrorCode" AS ENUM ('NETWORK', 'TIMEOUT', 'RATE_LIMITED', 'HTTP_4XX', 'HTTP_5XX', 'ACCESS_DENIED', 'PARSE_ERROR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DiscoveredUrlStatus" AS ENUM ('CANDIDATE', 'FETCHED', 'REJECTED', 'QUARANTINED');

-- CreateTable
CREATE TABLE "crawl_runs" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "CrawlRunStatus" NOT NULL DEFAULT 'RUNNING',
    "http_status" INTEGER,
    "success" BOOLEAN,
    "error_code" "CrawlErrorCode",

    CONSTRAINT "crawl_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovered_urls" (
    "id" UUID NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "found_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen_count" INTEGER NOT NULL DEFAULT 1,
    "relevance_score" DOUBLE PRECISION,
    "status" "DiscoveredUrlStatus" NOT NULL DEFAULT 'CANDIDATE',

    CONSTRAINT "discovered_urls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_observations" (
    "id" UUID NOT NULL,
    "discovered_url_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "crawl_run_id" UUID NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen_count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "discovery_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crawl_runs_source_started_idx" ON "crawl_runs"("source_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "crawl_runs_id_source_key" ON "crawl_runs"("id", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "discovered_urls_canonical_url_key" ON "discovered_urls"("canonical_url");

-- CreateIndex
CREATE INDEX "discovery_observations_source_seen_idx" ON "discovery_observations"("source_id", "first_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "discovery_observations_url_run_key" ON "discovery_observations"("discovered_url_id", "crawl_run_id");

-- AddForeignKey
ALTER TABLE "crawl_runs" ADD CONSTRAINT "crawl_runs_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_observations" ADD CONSTRAINT "discovery_observations_discovered_url_id_fkey" FOREIGN KEY ("discovered_url_id") REFERENCES "discovered_urls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_observations" ADD CONSTRAINT "discovery_observations_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovery_observations" ADD CONSTRAINT "discovery_observations_crawl_run_id_source_id_fkey" FOREIGN KEY ("crawl_run_id", "source_id") REFERENCES "crawl_runs"("id", "source_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "crawl_runs" ADD CONSTRAINT "crawl_runs_attempt_positive_check" CHECK ("attempt" > 0);
ALTER TABLE "crawl_runs" ADD CONSTRAINT "crawl_runs_http_status_check" CHECK ("http_status" IS NULL OR "http_status" BETWEEN 100 AND 599);
ALTER TABLE "crawl_runs" ADD CONSTRAINT "crawl_runs_lifecycle_check" CHECK (
    ("status" = 'RUNNING' AND "finished_at" IS NULL AND "success" IS NULL AND "error_code" IS NULL) OR
    ("status" = 'SUCCEEDED' AND "finished_at" IS NOT NULL AND "finished_at" >= "started_at" AND "success" = true AND "error_code" IS NULL) OR
    ("status" = 'FAILED' AND "finished_at" IS NOT NULL AND "finished_at" >= "started_at" AND "success" = false AND "error_code" IS NOT NULL)
);
ALTER TABLE "discovered_urls" ADD CONSTRAINT "discovered_urls_seen_count_check" CHECK ("seen_count" > 0);
ALTER TABLE "discovered_urls" ADD CONSTRAINT "discovered_urls_relevance_score_check" CHECK ("relevance_score" IS NULL OR "relevance_score" BETWEEN 0 AND 1);
ALTER TABLE "discovery_observations" ADD CONSTRAINT "discovery_observations_seen_count_check" CHECK ("seen_count" > 0);
