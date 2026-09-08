-- CreateTable
CREATE TABLE "ErpSimMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "qty" DECIMAL(30,10) NOT NULL,
    "warehouseCode" TEXT,
    "lotNo" TEXT,
    "customerCode" TEXT,
    "refDocType" TEXT,
    "refDocNo" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpSimMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimLot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "lotNo" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "qty" DECIMAL(30,10) NOT NULL,
    "warehouseCode" TEXT,
    "customerCode" TEXT,
    "supplierCode" TEXT,
    "receivedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" TEXT,

    CONSTRAINT "ErpSimLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErpSimMovement_tenantId_materialCode_idx" ON "ErpSimMovement"("tenantId", "materialCode");

-- CreateIndex
CREATE INDEX "ErpSimMovement_tenantId_customerCode_idx" ON "ErpSimMovement"("tenantId", "customerCode");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimMovement_tenantId_externalId_key" ON "ErpSimMovement"("tenantId", "externalId");

-- CreateIndex
CREATE INDEX "ErpSimLot_tenantId_materialCode_idx" ON "ErpSimLot"("tenantId", "materialCode");

-- CreateIndex
CREATE INDEX "ErpSimLot_tenantId_customerCode_idx" ON "ErpSimLot"("tenantId", "customerCode");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimLot_tenantId_externalId_key" ON "ErpSimLot"("tenantId", "externalId");

-- AddForeignKey
ALTER TABLE "ErpSimMovement" ADD CONSTRAINT "ErpSimMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSimLot" ADD CONSTRAINT "ErpSimLot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
