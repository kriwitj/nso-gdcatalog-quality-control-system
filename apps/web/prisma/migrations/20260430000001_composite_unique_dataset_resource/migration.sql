-- Dataset: เปลี่ยน unique(ckan_id) → unique(ckan_id, ckan_source_id)
DROP INDEX IF EXISTS "datasets_ckan_id_key";
CREATE UNIQUE INDEX "datasets_ckan_id_ckan_source_id_key" ON "datasets"("ckan_id", "ckan_source_id");

-- Resource: เปลี่ยน unique(ckan_id) → unique(ckan_id, package_id)
DROP INDEX IF EXISTS "resources_ckan_id_key";
CREATE UNIQUE INDEX "resources_ckan_id_package_id_key" ON "resources"("ckan_id", "package_id");
