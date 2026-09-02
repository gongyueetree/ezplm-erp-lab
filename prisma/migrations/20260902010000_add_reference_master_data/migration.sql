-- CreateTable
CREATE TABLE "ErpSimManufacturer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "manufacturerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    CONSTRAINT "ErpSimManufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimWarehouse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "warehouseCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    CONSTRAINT "ErpSimWarehouse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimManufacturer_tenantId_externalId_key" ON "ErpSimManufacturer"("tenantId", "externalId");
CREATE UNIQUE INDEX "ErpSimManufacturer_tenantId_manufacturerCode_key" ON "ErpSimManufacturer"("tenantId", "manufacturerCode");
CREATE UNIQUE INDEX "ErpSimManufacturer_tenantId_name_key" ON "ErpSimManufacturer"("tenantId", "name");
CREATE UNIQUE INDEX "ErpSimWarehouse_tenantId_externalId_key" ON "ErpSimWarehouse"("tenantId", "externalId");
CREATE UNIQUE INDEX "ErpSimWarehouse_tenantId_warehouseCode_key" ON "ErpSimWarehouse"("tenantId", "warehouseCode");

-- AddForeignKey
ALTER TABLE "ErpSimManufacturer" ADD CONSTRAINT "ErpSimManufacturer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ErpSimWarehouse" ADD CONSTRAINT "ErpSimWarehouse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill manufacturer master data from existing material records.
INSERT INTO "ErpSimManufacturer" ("id", "tenantId", "externalId", "manufacturerCode", "name", "status", "sourceUpdatedAt")
SELECT
  md5("tenantId" || ':manufacturer:' || "manufacturer"),
  "tenantId",
  'MFR-' || upper(substr(md5("manufacturer"), 1, 8)),
  'MFR-' || upper(substr(md5("manufacturer"), 1, 8)),
  "manufacturer",
  'ACTIVE',
  CURRENT_TIMESTAMP
FROM "ErpSimMaterial"
WHERE "manufacturer" IS NOT NULL AND btrim("manufacturer") <> ''
GROUP BY "tenantId", "manufacturer";

-- Backfill warehouse master data from inventory and Excess records.
INSERT INTO "ErpSimWarehouse" ("id", "tenantId", "externalId", "warehouseCode", "name", "status", "sourceUpdatedAt")
SELECT
  md5("tenantId" || ':warehouse:' || "warehouseCode"),
  "tenantId",
  'WH-' || upper(substr(md5("warehouseCode"), 1, 8)),
  "warehouseCode",
  coalesce(max("warehouseName"), "warehouseCode"),
  'ACTIVE',
  CURRENT_TIMESTAMP
FROM "ErpSimInventory"
WHERE "warehouseCode" IS NOT NULL AND btrim("warehouseCode") <> ''
GROUP BY "tenantId", "warehouseCode";

INSERT INTO "ErpSimWarehouse" ("id", "tenantId", "externalId", "warehouseCode", "name", "status", "sourceUpdatedAt")
SELECT
  md5(e."tenantId" || ':warehouse:' || e."warehouseCode"),
  e."tenantId",
  'WH-' || upper(substr(md5(e."warehouseCode"), 1, 8)),
  e."warehouseCode",
  e."warehouseCode",
  'ACTIVE',
  CURRENT_TIMESTAMP
FROM "ErpSimExcess" e
WHERE e."warehouseCode" IS NOT NULL AND btrim(e."warehouseCode") <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "ErpSimWarehouse" w
    WHERE w."tenantId" = e."tenantId" AND w."warehouseCode" = e."warehouseCode"
  )
GROUP BY e."tenantId", e."warehouseCode";
