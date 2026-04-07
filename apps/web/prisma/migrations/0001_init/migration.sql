-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable organizations
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "ckan_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organizations_ckan_id_key" ON "organizations"("ckan_id");

-- CreateTable datasets
CREATE TABLE "datasets" (
    "id" TEXT NOT NULL,
    "ckan_id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "license" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "groups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "update_frequency" TEXT,
    "metadata_created" TIMESTAMP(3),
    "metadata_modified" TIMESTAMP(3),
    "resource_count" INTEGER NOT NULL DEFAULT 0,
    "is_open" BOOLEAN NOT NULL DEFAULT false,
    "completeness_score" DOUBLE PRECISION,
    "timeliness_score" DOUBLE PRECISION,
    "accessibility_score" DOUBLE PRECISION,
    "machine_readable_score" DOUBLE PRECISION,
    "validity_score" DOUBLE PRECISION,
    "overall_score" DOUBLE PRECISION,
    "quality_grade" TEXT,
    "machine_readable_status" TEXT,
    "timeliness_status" TEXT,
    "last_scan_at" TIMESTAMP(3),
    "last_scan_status" TEXT,
    "scan_error_msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "datasets_ckan_id_key" ON "datasets"("ckan_id");
CREATE INDEX "datasets_organization_id_idx" ON "datasets"("organization_id");
CREATE INDEX "datasets_overall_score_idx" ON "datasets"("overall_score");
CREATE INDEX "datasets_quality_grade_idx" ON "datasets"("quality_grade");
CREATE INDEX "datasets_last_scan_at_idx" ON "datasets"("last_scan_at");

-- CreateTable resources
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "ckan_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "format" TEXT,
    "url" TEXT,
    "size" BIGINT,
    "mime_type" TEXT,
    "hash" TEXT,
    "metadata_modified" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "resources_ckan_id_key" ON "resources"("ckan_id");
CREATE INDEX "resources_package_id_idx" ON "resources"("package_id");

-- CreateTable scan_jobs
CREATE TABLE "scan_jobs" (
    "id" TEXT NOT NULL,
    "dataset_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "type" TEXT NOT NULL DEFAULT 'full',
    "triggered_by" TEXT,
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "done_items" INTEGER NOT NULL DEFAULT 0,
    "error_items" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error_msg" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scan_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "scan_jobs_status_idx" ON "scan_jobs"("status");
CREATE INDEX "scan_jobs_created_at_idx" ON "scan_jobs"("created_at");

-- CreateTable resource_checks
CREATE TABLE "resource_checks" (
    "id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "scan_job_id" TEXT,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "http_status" INTEGER,
    "downloadable" BOOLEAN,
    "content_type" TEXT,
    "file_size" BIGINT,
    "redirect_url" TEXT,
    "detected_format" TEXT,
    "is_machine_readable" BOOLEAN,
    "is_structured" BOOLEAN,
    "structured_status" TEXT,
    "timeliness_status" TEXT,
    "encoding" TEXT,
    "row_count" INTEGER,
    "column_count" INTEGER,
    "is_valid" BOOLEAN,
    "error_count" INTEGER,
    "warning_count" INTEGER,
    "partial_scan" BOOLEAN NOT NULL DEFAULT false,
    "scan_duration_ms" INTEGER,
    "error_msg" TEXT,
    CONSTRAINT "resource_checks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "resource_checks_resource_id_idx" ON "resource_checks"("resource_id");
CREATE INDEX "resource_checks_checked_at_idx" ON "resource_checks"("checked_at");

-- CreateTable validity_reports
CREATE TABLE "validity_reports" (
    "id" TEXT NOT NULL,
    "check_id" TEXT NOT NULL,
    "blank_header" INTEGER NOT NULL DEFAULT 0,
    "duplicate_header" INTEGER NOT NULL DEFAULT 0,
    "blank_row" INTEGER NOT NULL DEFAULT 0,
    "extra_value" INTEGER NOT NULL DEFAULT 0,
    "extra_header" INTEGER NOT NULL DEFAULT 0,
    "missing_value" INTEGER NOT NULL DEFAULT 0,
    "format_error" INTEGER NOT NULL DEFAULT 0,
    "schema_error" INTEGER NOT NULL DEFAULT 0,
    "encoding_error" INTEGER NOT NULL DEFAULT 0,
    "source_error" INTEGER NOT NULL DEFAULT 0,
    "encoding" TEXT,
    "error_message" TEXT,
    "valid" BOOLEAN,
    "severity" TEXT,
    "primary_issue" TEXT,
    "raw_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "validity_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "validity_reports_check_id_key" ON "validity_reports"("check_id");

-- CreateTable quality_score_history
CREATE TABLE "quality_score_history" (
    "id" TEXT NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completeness_score" DOUBLE PRECISION,
    "timeliness_score" DOUBLE PRECISION,
    "accessibility_score" DOUBLE PRECISION,
    "machine_readable_score" DOUBLE PRECISION,
    "validity_score" DOUBLE PRECISION,
    "overall_score" DOUBLE PRECISION,
    "quality_grade" TEXT,
    CONSTRAINT "quality_score_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "quality_score_history_dataset_id_recorded_at_idx" ON "quality_score_history"("dataset_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "datasets" ADD CONSTRAINT "datasets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resources" ADD CONSTRAINT "resources_package_id_fkey"
    FOREIGN KEY ("package_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_dataset_id_fkey"
    FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resource_checks" ADD CONSTRAINT "resource_checks_resource_id_fkey"
    FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "validity_reports" ADD CONSTRAINT "validity_reports_check_id_fkey"
    FOREIGN KEY ("check_id") REFERENCES "resource_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quality_score_history" ADD CONSTRAINT "quality_score_history_dataset_id_fkey"
    FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
