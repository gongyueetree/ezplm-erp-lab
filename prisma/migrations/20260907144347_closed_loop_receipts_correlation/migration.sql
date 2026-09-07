-- AlterTable
ALTER TABLE "ErpSimPurchaseOrderLine" ADD COLUMN     "receivedQty" DECIMAL(30,10);

-- AlterTable
ALTER TABLE "ErpSimRequestLog" ADD COLUMN     "correlationId" TEXT;

-- CreateTable
CREATE TABLE "ErpSimReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "poExternalId" TEXT NOT NULL,
    "poNumber" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT,

    CONSTRAINT "ErpSimReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErpSimReceiptLine" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "materialCode" TEXT NOT NULL,
    "qty" DECIMAL(30,10) NOT NULL,
    "lotNo" TEXT,
    "warehouseCode" TEXT,

    CONSTRAINT "ErpSimReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimReceipt_tenantId_externalId_key" ON "ErpSimReceipt"("tenantId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ErpSimReceipt_tenantId_idempotencyKey_key" ON "ErpSimReceipt"("tenantId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "ErpSimReceipt" ADD CONSTRAINT "ErpSimReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "ErpSimTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErpSimReceiptLine" ADD CONSTRAINT "ErpSimReceiptLine_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "ErpSimReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
