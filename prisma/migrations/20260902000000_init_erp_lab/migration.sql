-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "ErpSimTenant" (
    "id" TEXT NOT NULL,
    "datasetName" TEXT NOT NULL,
    "seededAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpSimTenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimMaterial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "internalPn" TEXT,
    "manufacturer" TEXT,
    "mpn" TEXT,
    "description" TEXT,
    "specification" TEXT,
    "unit" TEXT,
    "lifecycle" TEXT,
    "status" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "ErpSimMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimInventory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "warehouseCode" TEXT,
    "warehouseName" TEXT,
    "customerCode" TEXT,
    "onHandQty" DECIMAL(30,10) NOT NULL,
    "availableQty" DECIMAL(30,10),
    "reservedQty" DECIMAL(30,10),
    "lotNo" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "ErpSimInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimExcess" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "customerCode" TEXT,
    "warehouseCode" TEXT,
    "bookQty" DECIMAL(30,10) NOT NULL,
    "availableQty" DECIMAL(30,10) NOT NULL,
    "earliestInboundAt" TIMESTAMP(3),
    "sourceDocumentId" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "ErpSimExcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimSupplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "supplierCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "currency" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "ErpSimSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimCustomer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "customerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "ErpSimCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimExchangeRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" DECIMAL(30,12) NOT NULL,
    "rateType" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "ErpSimExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimPurchaseOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT,
    "poNumber" TEXT,
    "supplierCode" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "requestedDate" TIMESTAMP(3),
    "status" TEXT,
    "idempotencyKey" TEXT,

    CONSTRAINT "ErpSimPurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimPurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "materialCode" TEXT NOT NULL,
    "qty" DECIMAL(30,10) NOT NULL,
    "unitPrice" DECIMAL(30,10) NOT NULL,
    "requestedDate" TIMESTAMP(3),
    "confirmedQty" DECIMAL(30,10),
    "eta" TIMESTAMP(3),
    "shipDate" TIMESTAMP(3),

    CONSTRAINT "ErpSimPurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimScenario" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "failureRate" DOUBLE PRECISION NOT NULL,
    "targetOperation" TEXT,

    CONSTRAINT "ErpSimScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimRequestLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "operation" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "latency" INTEGER NOT NULL,
    "scenario" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "ErpSimRequestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "result" TEXT NOT NULL,
    "details" TEXT,

    CONSTRAINT "ErpSimAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimMappingProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "datasetType" TEXT NOT NULL,
    "mappings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ErpSimMappingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErpSimMaterial_tenantId_materialCode_idx" ON "ErpSimMaterial"("tenantId", "materialCode");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimMaterial_tenantId_externalId_key" ON "ErpSimMaterial"("tenantId", "externalId");

-- CreateIndex
CREATE INDEX "ErpSimInventory_tenantId_materialCode_idx" ON "ErpSimInventory"("tenantId", "materialCode");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimInventory_tenantId_externalId_key" ON "ErpSimInventory"("tenantId", "externalId");

-- CreateIndex
CREATE INDEX "ErpSimExcess_tenantId_materialCode_idx" ON "ErpSimExcess"("tenantId", "materialCode");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimExcess_tenantId_externalId_key" ON "ErpSimExcess"("tenantId", "externalId");

-- CreateIndex
CREATE INDEX "ErpSimSupplier_tenantId_supplierCode_idx" ON "ErpSimSupplier"("tenantId", "supplierCode");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimSupplier_tenantId_externalId_key" ON "ErpSimSupplier"("tenantId", "externalId");

-- CreateIndex
CREATE INDEX "ErpSimCustomer_tenantId_customerCode_idx" ON "ErpSimCustomer"("tenantId", "customerCode");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimCustomer_tenantId_externalId_key" ON "ErpSimCustomer"("tenantId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimExchangeRate_tenantId_baseCurrency_quoteCurrency_effe_key" ON "ErpSimExchangeRate"("tenantId", "baseCurrency", "quoteCurrency", "effectiveDate");

-- CreateIndex
CREATE INDEX "ErpSimPurchaseOrder_tenantId_poNumber_idx" ON "ErpSimPurchaseOrder"("tenantId", "poNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimPurchaseOrder_tenantId_externalId_key" ON "ErpSimPurchaseOrder"("tenantId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimPurchaseOrder_tenantId_idempotencyKey_key" ON "ErpSimPurchaseOrder"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimPurchaseOrderLine_purchaseOrderId_lineNo_key" ON "ErpSimPurchaseOrderLine"("purchaseOrderId", "lineNo");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimScenario_tenantId_key" ON "ErpSimScenario"("tenantId");

-- CreateIndex
CREATE INDEX "ErpSimRequestLog_tenantId_timestamp_idx" ON "ErpSimRequestLog"("tenantId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "ErpSimAuditLog_tenantId_timestamp_idx" ON "ErpSimAuditLog"("tenantId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "ErpSimMappingProfile_tenantId_datasetType_idx" ON "ErpSimMappingProfile"("tenantId", "datasetType");

-- AddForeignKey
ALTER TABLE "ErpSimMaterial" ADD CONSTRAINT "ErpSimMaterial_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSimInventory" ADD CONSTRAINT "ErpSimInventory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSimExcess" ADD CONSTRAINT "ErpSimExcess_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSimSupplier" ADD CONSTRAINT "ErpSimSupplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSimCustomer" ADD CONSTRAINT "ErpSimCustomer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSimExchangeRate" ADD CONSTRAINT "ErpSimExchangeRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSimPurchaseOrder" ADD CONSTRAINT "ErpSimPurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSimPurchaseOrderLine" ADD CONSTRAINT "ErpSimPurchaseOrderLine_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "ErpSimPurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSimScenario" ADD CONSTRAINT "ErpSimScenario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSimRequestLog" ADD CONSTRAINT "ErpSimRequestLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSimAuditLog" ADD CONSTRAINT "ErpSimAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSimMappingProfile" ADD CONSTRAINT "ErpSimMappingProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


