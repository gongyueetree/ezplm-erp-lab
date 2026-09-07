export type DecimalString = string

export interface ErpMaterial {
  externalId: string
  materialCode: string
  internalPn?: string
  manufacturer?: string
  mpn?: string
  description?: string
  specification?: string
  unit?: string
  lifecycle?: string
  status?: string
  updatedAt?: string
}

export interface ErpInventory {
  externalId: string
  materialCode: string
  warehouseCode?: string
  warehouseName?: string
  customerCode?: string
  onHandQty: DecimalString
  availableQty?: DecimalString
  reservedQty?: DecimalString
  lotNo?: string
  updatedAt?: string
}

export interface ErpExcess {
  externalId: string
  materialCode: string
  customerCode?: string
  warehouseCode?: string
  bookQty: DecimalString
  availableQty: DecimalString
  earliestInboundAt?: string
  sourceDocumentId?: string
  sourceUpdatedAt?: string
}

export interface ErpSupplier {
  externalId: string
  supplierCode: string
  name: string
  status?: string
  currency?: string
  updatedAt?: string
}

export interface ErpCustomer {
  externalId: string
  customerCode: string
  name: string
  status?: string
  updatedAt?: string
}

export interface ErpExchangeRate {
  baseCurrency: string
  quoteCurrency: string
  rate: DecimalString
  rateType?: string
  effectiveDate: string
  source: string
}

export interface ErpPurchaseOrderLine {
  lineNo: number
  materialCode: string
  qty: DecimalString
  unitPrice: DecimalString
  requestedDate?: string
  confirmedQty?: DecimalString
  /** closed-loop: 累计收货量(receivePurchaseOrder 维护) */
  receivedQty?: DecimalString
  eta?: string
  shipDate?: string
}

export interface ErpPurchaseOrder {
  externalId?: string
  poNumber?: string
  supplierCode: string
  currency: string
  orderDate: string
  requestedDate?: string
  status?: 'OPEN' | 'PARTIALLY_RECEIVED' | 'CLOSED'
  idempotencyKey?: string
  lines: ErpPurchaseOrderLine[]
}

export interface ErpEtaUpdate {
  poExternalId?: string
  poNumber?: string
  lineNo: number
  confirmedQty?: DecimalString
  eta?: string
  shipDate?: string
}

// LAB-1: 工单（ECN 影响分析与缺料/齐料闭环的数据源）。
// consumedLines.materialCode 必须引用 materials；customerCode 引用 customers。
// productCode 是成品编码——Lab 暂无成品主数据集，保持自由文本（如实标注）。
export interface ErpWorkOrderLine {
  materialCode: string
  consumedQty: DecimalString
}

export interface ErpWorkOrder {
  externalId: string
  woNumber: string
  customerCode?: string
  productCode: string
  bomRef?: string
  qty: DecimalString
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SHIPPED'
  currentOperation?: string
  consumedLines: ErpWorkOrderLine[]
  plannedStart?: string
  plannedEnd?: string
}

// LAB-1: 销售订单（客户需求侧）。customerCode 必须引用 customers。
export interface ErpSalesOrderLine {
  lineNo: number
  productCode: string
  qty: DecimalString
  shippedQty?: DecimalString
  requestedDate?: string
}

export interface ErpSalesOrder {
  externalId: string
  soNumber: string
  customerCode: string
  status?: string
  lines: ErpSalesOrderLine[]
}

// closed-loop: 收货(最小闭环:PO → 收货 → 库存增加 → PO 状态推进)
export interface ErpReceiptLine {
  lineNo: number
  materialCode: string
  qty: DecimalString
  lotNo?: string
  warehouseCode?: string
}

export interface ErpReceipt {
  externalId: string
  receiptNumber: string
  poExternalId: string
  poNumber?: string
  receivedAt: string
  idempotencyKey?: string
  lines: ErpReceiptLine[]
}

export interface ErpReceiveInput {
  poExternalId?: string
  poNumber?: string
  lines: { lineNo: number; qty: DecimalString; lotNo?: string; warehouseCode?: string }[]
}

export interface PullOptions {
  updatedSince?: string
  cursor?: string
  limit?: number
  // closed-loop: 服务端过滤(数据最小化;门户/影响分析按需取数,不全量拉取)
  customerCode?: string
  materialCode?: string
  warehouseCode?: string
}

/** 分页信封:pull* 的统一返回。cursor 为不透明串;hasMore=false 时不再翻页 */
export interface ErpPullPage<T> {
  items: T[]
  cursor?: string
  hasMore: boolean
  total?: number
}

export interface ErpConnectionResult {
  connected: boolean
  provider: string
  message: string
  checkedAt: string
}

export interface ErpWriteResult {
  success: boolean
  externalId?: string
  documentNumber?: string
  idempotentReplay?: boolean
  message?: string
}

export type DatasetType = 'MATERIAL' | 'INVENTORY' | 'EXCESS' | 'SUPPLIER' | 'CUSTOMER' | 'OPEN_PO' | 'FX' | 'WORK_ORDER' | 'SALES_ORDER'

export type ScenarioCode =
  | 'NORMAL'
  | 'SLOW_ERP'
  | 'AUTH_EXPIRED'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'PARTIAL_RESPONSE'
  | 'DUPLICATE_PO'
  | 'MATERIAL_NOT_FOUND'
  | 'SUPPLIER_NOT_FOUND'
  | 'FX_MISSING'
  | 'PO_ALREADY_EXISTS'
  | 'ERP_500'
  | 'NETWORK_DROP_AFTER_COMMIT'
  | 'WORK_ORDER_SOURCE_UNAVAILABLE'

export interface ErpSimScenario {
  code: ScenarioCode
  enabled: boolean
  latencyMs: number
  failureRate: number
  targetOperation?: string
}

export interface ErpRequestLog {
  id: string
  tenantId: string
  timestamp: string
  operation: string
  requestId: string
  /** closed-loop: 主系统传入的关联 id(X-Correlation-Id),两边日志可对齐 */
  correlationId?: string
  attempt: number
  requestPayload?: unknown
  responsePayload?: unknown
  latency: number
  scenario: ScenarioCode
  result: 'SUCCESS' | 'FAILED' | 'COMMITTED_NO_RESPONSE'
  errorCode?: string
  errorMessage?: string
}

export interface AuditEntry {
  id: string
  tenantId: string
  timestamp: string
  actor: string
  action: string
  entityType: string
  entityId?: string
  result: 'SUCCESS' | 'FAILED'
  details?: string
}

export interface MappingProfile {
  id: string
  name: string
  datasetType: DatasetType
  mappings: { sourceColumn: string; targetField: string }[]
  createdAt: string
}

export interface ImportReport {
  datasetType: DatasetType
  rowsRead: number
  rowsImported: number
  errors: string[]
  brokenReferences: { type: string; value: string; row: number }[]
}

export interface SimulatorDataset {
  version: number
  tenantId: string
  datasetName: string
  seededAt: string
  materials: ErpMaterial[]
  inventory: ErpInventory[]
  excess: ErpExcess[]
  suppliers: ErpSupplier[]
  customers: ErpCustomer[]
  exchangeRates: ErpExchangeRate[]
  purchaseOrders: ErpPurchaseOrder[]
  receipts: ErpReceipt[]
  workOrders: ErpWorkOrder[]
  salesOrders: ErpSalesOrder[]
  scenario: ErpSimScenario
  requestLogs: ErpRequestLog[]
  auditLogs: AuditEntry[]
  mappingProfiles: MappingProfile[]
}

export class ErpProviderError extends Error {
  constructor(public code: string, message: string, public retryable = false, public httpStatus = 500) {
    super(message)
    this.name = 'ErpProviderError'
  }
}
