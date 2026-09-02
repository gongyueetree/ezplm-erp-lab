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

export interface PullOptions {
  updatedSince?: string
  cursor?: string
  limit?: number
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

export type DatasetType = 'MATERIAL' | 'INVENTORY' | 'EXCESS' | 'SUPPLIER' | 'CUSTOMER' | 'OPEN_PO' | 'FX'

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
