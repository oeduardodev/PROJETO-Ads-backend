-- AlterTable
ALTER TABLE "selection_processes" ADD COLUMN     "verified_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "processes_publication_verified_idx" ON "selection_processes"("publication_status", "verified_at", "id");
