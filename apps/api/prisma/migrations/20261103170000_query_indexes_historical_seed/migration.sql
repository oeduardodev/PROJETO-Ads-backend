-- AlterTable
ALTER TABLE "selection_processes" ADD COLUMN     "demo_historical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reference_url" TEXT;

-- CreateIndex
CREATE INDEX "windows_end_date_time_idx" ON "application_windows"("end_date", "end_time");

-- CreateIndex
CREATE INDEX "offerings_modality_degree_idx" ON "offerings"("modality", "degree_type");

-- CreateIndex
CREATE INDEX "processes_publication_institution_idx" ON "selection_processes"("publication_status", "institution_id");

-- CreateIndex
CREATE INDEX "processes_type_enem_idx" ON "selection_processes"("selection_type", "requires_enem");

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "offerings_course_trgm_idx" ON "offerings" USING GIN ("normalized_course_name" gin_trgm_ops);

ALTER TABLE "selection_processes" ADD CONSTRAINT "processes_demo_never_published_check"
CHECK (NOT "demo_historical" OR "publication_status" <> 'PUBLICADO');
ALTER TABLE "selection_processes" ADD CONSTRAINT "processes_reference_https_check"
CHECK ("reference_url" IS NULL OR "reference_url" ~ '^https://[^/]+/');
ALTER TABLE "selection_processes" ADD CONSTRAINT "processes_notice_year_check"
CHECK ("notice_year" IS NULL OR "notice_year" BETWEEN 1900 AND 9999);
