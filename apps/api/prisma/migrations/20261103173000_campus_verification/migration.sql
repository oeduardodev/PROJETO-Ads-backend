-- AlterTable
ALTER TABLE "campuses" ADD COLUMN     "verified_at" TIMESTAMPTZ(6);

CREATE INDEX "campuses_institution_verified_idx" ON "campuses"("institution_id", "verified_at");
