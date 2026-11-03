-- CreateEnum
CREATE TYPE "Jurisdiction" AS ENUM ('FEDERAL', 'ESTADUAL');

-- CreateTable
CREATE TABLE "institutions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(250) NOT NULL,
    "normalized_name" VARCHAR(250) NOT NULL,
    "acronym" VARCHAR(16) NOT NULL,
    "jurisdiction" "Jurisdiction" NOT NULL,
    "public_flag" BOOLEAN NOT NULL DEFAULT true,
    "verified_at" TIMESTAMPTZ(6),
    "reference_url" TEXT,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campuses" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "normalized_name" VARCHAR(200) NOT NULL,
    "city" VARCHAR(150) NOT NULL,
    "normalized_city" VARCHAR(150) NOT NULL,
    "state" CHAR(2) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,

    CONSTRAINT "campuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "institutions_normalized_name_key" ON "institutions"("normalized_name");

-- CreateIndex
CREATE UNIQUE INDEX "institutions_acronym_key" ON "institutions"("acronym");

-- CreateIndex
CREATE INDEX "campuses_state_city_idx" ON "campuses"("state", "normalized_city");

-- CreateIndex
CREATE UNIQUE INDEX "campuses_institution_name_city_key" ON "campuses"("institution_id", "normalized_name", "normalized_city");

-- AddForeignKey
ALTER TABLE "campuses" ADD CONSTRAINT "campuses_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma não expressa CHECK; mantenha a validação de UF também no banco.
ALTER TABLE "campuses" ADD CONSTRAINT "campuses_state_valid_check" CHECK (
    "state" IN ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
                'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO')
);
