-- CreateTable: ministries
CREATE TABLE "ministries" (
    "id"         TEXT         NOT NULL,
    "name"       TEXT         NOT NULL,
    "code"       TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ministries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ministries_name_key" ON "ministries"("name");
CREATE UNIQUE INDEX "ministries_code_key" ON "ministries"("code");

-- CreateTable: departments
CREATE TABLE "departments" (
    "id"          TEXT         NOT NULL,
    "ministry_id" TEXT         NOT NULL,
    "name"        TEXT         NOT NULL,
    "code"        TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "departments_ministry_id_name_key" ON "departments"("ministry_id", "name");
CREATE INDEX "departments_ministry_id_idx" ON "departments"("ministry_id");
ALTER TABLE "departments"
    ADD CONSTRAINT "departments_ministry_id_fkey"
    FOREIGN KEY ("ministry_id") REFERENCES "ministries"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: divisions
CREATE TABLE "divisions" (
    "id"            TEXT         NOT NULL,
    "department_id" TEXT         NOT NULL,
    "name"          TEXT         NOT NULL,
    "code"          TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "divisions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "divisions_department_id_name_key" ON "divisions"("department_id", "name");
CREATE INDEX "divisions_department_id_idx" ON "divisions"("department_id");
ALTER TABLE "divisions"
    ADD CONSTRAINT "divisions_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: groups
CREATE TABLE "groups" (
    "id"          TEXT         NOT NULL,
    "division_id" TEXT         NOT NULL,
    "name"        TEXT         NOT NULL,
    "code"        TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "groups_division_id_name_key" ON "groups"("division_id", "name");
CREATE INDEX "groups_division_id_idx" ON "groups"("division_id");
ALTER TABLE "groups"
    ADD CONSTRAINT "groups_division_id_fkey"
    FOREIGN KEY ("division_id") REFERENCES "divisions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: ckan_sources
CREATE TABLE "ckan_sources" (
    "id"            TEXT         NOT NULL,
    "name"          TEXT         NOT NULL,
    "url"           TEXT         NOT NULL,
    "api_key"       TEXT,
    "is_active"     BOOLEAN      NOT NULL DEFAULT true,
    "ministry_id"   TEXT,
    "department_id" TEXT,
    "division_id"   TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ckan_sources_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ckan_sources_url_key" ON "ckan_sources"("url");
ALTER TABLE "ckan_sources"
    ADD CONSTRAINT "ckan_sources_ministry_id_fkey"
    FOREIGN KEY ("ministry_id") REFERENCES "ministries"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ckan_sources"
    ADD CONSTRAINT "ckan_sources_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ckan_sources"
    ADD CONSTRAINT "ckan_sources_division_id_fkey"
    FOREIGN KEY ("division_id") REFERENCES "divisions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable users: add RBAC scope columns
ALTER TABLE "users"
    ADD COLUMN "ministry_id"   TEXT,
    ADD COLUMN "department_id" TEXT,
    ADD COLUMN "division_id"   TEXT,
    ADD COLUMN "group_id"      TEXT;

ALTER TABLE "users"
    ADD CONSTRAINT "users_ministry_id_fkey"
    FOREIGN KEY ("ministry_id") REFERENCES "ministries"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users"
    ADD CONSTRAINT "users_department_id_fkey"
    FOREIGN KEY ("department_id") REFERENCES "departments"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users"
    ADD CONSTRAINT "users_division_id_fkey"
    FOREIGN KEY ("division_id") REFERENCES "divisions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users"
    ADD CONSTRAINT "users_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "groups"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default CkanSource from env (ถ้ามี CKAN_BASE_URL เดิมอยู่แล้ว)
-- ไม่ seed ที่นี่เพราะ migration ไม่รู้ค่า env — ให้ seed ผ่าน npm run db:seed แทน
