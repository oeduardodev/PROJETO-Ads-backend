CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'CURATOR');

CREATE TABLE "admin_users" (
  "id" UUID NOT NULL,
  "issuer" VARCHAR(512) NOT NULL,
  "subject" VARCHAR(255) NOT NULL,
  "role" "AdminRole" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_events" (
  "id" UUID NOT NULL,
  "actor_admin_user_id" UUID NOT NULL,
  "actor_issuer" VARCHAR(512) NOT NULL,
  "actor_subject" VARCHAR(255) NOT NULL,
  "action" VARCHAR(100) NOT NULL,
  "resource_type" VARCHAR(100) NOT NULL,
  "resource_id" VARCHAR(255) NOT NULL,
  "reason" TEXT NOT NULL,
  "before_json" JSONB,
  "after_json" JSONB,
  "request_id" VARCHAR(128),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_events_actor_admin_user_id_fkey"
    FOREIGN KEY ("actor_admin_user_id") REFERENCES "admin_users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "admin_users_issuer_subject_key" ON "admin_users"("issuer", "subject");
CREATE INDEX "admin_users_active_role_idx" ON "admin_users"("active", "role");
CREATE INDEX "audit_events_resource_created_idx" ON "audit_events"("resource_type", "resource_id", "created_at");
CREATE INDEX "audit_events_actor_created_idx" ON "audit_events"("actor_admin_user_id", "created_at");
