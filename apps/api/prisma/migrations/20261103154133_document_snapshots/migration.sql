-- CreateTable
CREATE TABLE "document_blobs" (
    "sha256" CHAR(64) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "byte_length" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_blobs_pkey" PRIMARY KEY ("sha256")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "discovered_url_id" UUID,
    "url" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "media_type" VARCHAR(128) NOT NULL,
    "version" INTEGER NOT NULL,
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issued_at" TIMESTAMPTZ(6),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_blobs_hash_storage_key" ON "document_blobs"("sha256", "storage_key");

-- CreateIndex
CREATE INDEX "documents_sha256_idx" ON "documents"("sha256");

-- CreateIndex
CREATE INDEX "documents_discovered_url_idx" ON "documents"("discovered_url_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_url_version_key" ON "documents"("url", "version");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_sha256_storage_key_fkey" FOREIGN KEY ("sha256", "storage_key") REFERENCES "document_blobs"("sha256", "storage_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_discovered_url_id_fkey" FOREIGN KEY ("discovered_url_id") REFERENCES "discovered_urls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_blobs" ADD CONSTRAINT "document_blobs_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$');
ALTER TABLE "document_blobs" ADD CONSTRAINT "document_blobs_length_positive_check" CHECK ("byte_length" > 0);
ALTER TABLE "documents" ADD CONSTRAINT "documents_version_positive_check" CHECK ("version" > 0);
ALTER TABLE "documents" ADD CONSTRAINT "documents_media_type_check" CHECK ("media_type" IN ('text/html', 'application/pdf'));
ALTER TABLE "documents" ADD CONSTRAINT "documents_last_seen_check" CHECK ("last_seen_at" >= "captured_at");
