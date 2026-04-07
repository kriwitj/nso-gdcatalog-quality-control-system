-- AlterTable datasets: add ckan_source_id for scope-based filtering
ALTER TABLE "datasets" ADD COLUMN "ckan_source_id" TEXT;
ALTER TABLE "datasets"
    ADD CONSTRAINT "datasets_ckan_source_id_fkey"
    FOREIGN KEY ("ckan_source_id") REFERENCES "ckan_sources"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "datasets_ckan_source_id_idx" ON "datasets"("ckan_source_id");

-- CreateTable: audit_logs
CREATE TABLE "audit_logs" (
    "id"         TEXT         NOT NULL,
    "user_id"    TEXT,
    "action"     TEXT         NOT NULL,
    "entity"     TEXT         NOT NULL,
    "entity_id"  TEXT,
    "detail"     JSONB,
    "ip"         TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_user_id_idx"    ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
