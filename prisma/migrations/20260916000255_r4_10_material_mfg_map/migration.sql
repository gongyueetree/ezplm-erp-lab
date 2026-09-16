-- CreateTable
CREATE TABLE "ErpSimMaterialMfgMap" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "internalPn" TEXT,
    "manufacturer" TEXT,
    "mpn" TEXT NOT NULL,
    "relationType" TEXT,
    "status" TEXT,
    "source" TEXT NOT NULL,
    "sourceDocumentNo" TEXT,
    "sourceRow" INTEGER,
    "observedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "ErpSimMaterialMfgMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErpSimMaterialMfgMap_tenantId_materialCode_idx" ON "ErpSimMaterialMfgMap"("tenantId", "materialCode");

-- CreateIndex
CREATE INDEX "ErpSimMaterialMfgMap_tenantId_mpn_idx" ON "ErpSimMaterialMfgMap"("tenantId", "mpn");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimMaterialMfgMap_tenantId_externalId_key" ON "ErpSimMaterialMfgMap"("tenantId", "externalId");

-- AddForeignKey
ALTER TABLE "ErpSimMaterialMfgMap" ADD CONSTRAINT "ErpSimMaterialMfgMap_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
