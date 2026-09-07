-- CreateTable
CREATE TABLE "ErpSimWorkOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "woNumber" TEXT NOT NULL,
    "customerCode" TEXT,
    "productCode" TEXT NOT NULL,
    "bomRef" TEXT,
    "qty" DECIMAL(30,10) NOT NULL,
    "status" TEXT NOT NULL,
    "currentOperation" TEXT,
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),

    CONSTRAINT "ErpSimWorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimWorkOrderLine" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "materialCode" TEXT NOT NULL,
    "consumedQty" DECIMAL(30,10) NOT NULL,

    CONSTRAINT "ErpSimWorkOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimSalesOrder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "soNumber" TEXT NOT NULL,
    "customerCode" TEXT NOT NULL,
    "status" TEXT,

    CONSTRAINT "ErpSimSalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimSalesOrderLine" (
    "id" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "productCode" TEXT NOT NULL,
    "qty" DECIMAL(30,10) NOT NULL,
    "shippedQty" DECIMAL(30,10),
    "requestedDate" TIMESTAMP(3),

    CONSTRAINT "ErpSimSalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ErpSimWorkOrder_tenantId_woNumber_idx" ON "ErpSimWorkOrder"("tenantId", "woNumber");

-- CreateIndex
CREATE INDEX "ErpSimWorkOrder_tenantId_status_idx" ON "ErpSimWorkOrder"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimWorkOrder_tenantId_externalId_key" ON "ErpSimWorkOrder"("tenantId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimWorkOrderLine_workOrderId_materialCode_key" ON "ErpSimWorkOrderLine"("workOrderId", "materialCode");

-- CreateIndex
CREATE INDEX "ErpSimSalesOrder_tenantId_soNumber_idx" ON "ErpSimSalesOrder"("tenantId", "soNumber");

-- CreateIndex
CREATE INDEX "ErpSimSalesOrder_tenantId_customerCode_idx" ON "ErpSimSalesOrder"("tenantId", "customerCode");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimSalesOrder_tenantId_externalId_key" ON "ErpSimSalesOrder"("tenantId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimSalesOrderLine_salesOrderId_lineNo_key" ON "ErpSimSalesOrderLine"("salesOrderId", "lineNo");

-- AddForeignKey
ALTER TABLE "ErpSimWorkOrder" ADD CONSTRAINT "ErpSimWorkOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSimWorkOrderLine" ADD CONSTRAINT "ErpSimWorkOrderLine_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "ErpSimWorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSimSalesOrder" ADD CONSTRAINT "ErpSimSalesOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSimSalesOrderLine" ADD CONSTRAINT "ErpSimSalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "ErpSimSalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
