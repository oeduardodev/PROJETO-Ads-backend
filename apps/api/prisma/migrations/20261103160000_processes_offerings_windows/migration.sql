-- CreateTable
CREATE TABLE "selection_processes" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "notice_code" VARCHAR(100),
    "notice_year" INTEGER,
    "selection_type" VARCHAR(64),
    "regular_sisu_flow" BOOLEAN,
    "requires_enem" BOOLEAN,
    "tuition_free" BOOLEAN,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "selection_processes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offerings" (
    "id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "campus_id" UUID,
    "course_name" VARCHAR(250) NOT NULL,
    "normalized_course_name" VARCHAR(250) NOT NULL,
    "degree_type" VARCHAR(32),
    "modality" VARCHAR(64),
    "shift" VARCHAR(64),
    "seats" INTEGER,

    CONSTRAINT "offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_reservations" (
    "id" UUID NOT NULL,
    "offering_id" UUID NOT NULL,
    "category" VARCHAR(150) NOT NULL,
    "normalized_category" VARCHAR(150) NOT NULL,
    "seats" INTEGER,

    CONSTRAINT "offering_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_windows" (
    "id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "offering_id" UUID,
    "label" VARCHAR(150),
    "start_date" DATE,
    "start_time" VARCHAR(5),
    "end_date" DATE,
    "end_time" VARCHAR(5),
    "timezone" VARCHAR(64),
    "instructions_url" TEXT,

    CONSTRAINT "application_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirements" (
    "id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "offering_id" UUID,
    "reservation_id" UUID,
    "criterion" VARCHAR(200) NOT NULL,
    "required" BOOLEAN,
    "value_json" JSONB,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processes_institution_notice_year_key" ON "selection_processes"("institution_id", "notice_code", "notice_year");

-- CreateIndex
CREATE UNIQUE INDEX "processes_id_institution_key" ON "selection_processes"("id", "institution_id");

-- CreateIndex
CREATE INDEX "offerings_course_idx" ON "offerings"("normalized_course_name");

-- CreateIndex
CREATE INDEX "offerings_campus_idx" ON "offerings"("campus_id");

-- CreateIndex
CREATE UNIQUE INDEX "offerings_id_process_key" ON "offerings"("id", "process_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_offering_category_key" ON "offering_reservations"("offering_id", "normalized_category");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_id_offering_key" ON "offering_reservations"("id", "offering_id");

-- CreateIndex
CREATE INDEX "windows_process_end_date_idx" ON "application_windows"("process_id", "end_date");

-- CreateIndex
CREATE INDEX "requirements_process_idx" ON "requirements"("process_id");

-- CreateIndex
CREATE UNIQUE INDEX "campuses_id_institution_key" ON "campuses"("id", "institution_id");

-- AddForeignKey
ALTER TABLE "selection_processes" ADD CONSTRAINT "selection_processes_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_process_id_institution_id_fkey" FOREIGN KEY ("process_id", "institution_id") REFERENCES "selection_processes"("id", "institution_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_campus_id_institution_id_fkey" FOREIGN KEY ("campus_id", "institution_id") REFERENCES "campuses"("id", "institution_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_reservations" ADD CONSTRAINT "offering_reservations_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_windows" ADD CONSTRAINT "application_windows_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "selection_processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_windows" ADD CONSTRAINT "application_windows_offering_id_process_id_fkey" FOREIGN KEY ("offering_id", "process_id") REFERENCES "offerings"("id", "process_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "selection_processes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_offering_id_process_id_fkey" FOREIGN KEY ("offering_id", "process_id") REFERENCES "offerings"("id", "process_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_reservation_id_offering_id_fkey" FOREIGN KEY ("reservation_id", "offering_id") REFERENCES "offering_reservations"("id", "offering_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "offerings" ADD CONSTRAINT "offerings_seats_nonnegative_check" CHECK ("seats" IS NULL OR "seats" >= 0);
ALTER TABLE "offering_reservations" ADD CONSTRAINT "reservations_seats_nonnegative_check" CHECK ("seats" IS NULL OR "seats" >= 0);
ALTER TABLE "application_windows" ADD CONSTRAINT "windows_time_format_check" CHECK (
    ("start_time" IS NULL OR ("start_date" IS NOT NULL AND "start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')) AND
    ("end_time" IS NULL OR ("end_date" IS NOT NULL AND "end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'))
);
ALTER TABLE "application_windows" ADD CONSTRAINT "windows_interval_check" CHECK (
    "start_date" IS NULL OR "end_date" IS NULL OR "start_date" < "end_date" OR
    ("start_date" = "end_date" AND ("start_time" IS NULL OR "end_time" IS NULL OR "start_time" <= "end_time"))
);
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_reservation_scope_check" CHECK ("reservation_id" IS NULL OR "offering_id" IS NOT NULL);
