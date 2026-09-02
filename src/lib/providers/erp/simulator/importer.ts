import type { DatasetType, ImportReport, MappingProfile, SimulatorDataset } from '../types.js'

const requiredFields: Record<DatasetType, string[]> = {
  MATERIAL: ['externalId', 'materialCode'], INVENTORY: ['externalId', 'materialCode', 'onHandQty'],
  EXCESS: ['externalId', 'materialCode', 'bookQty', 'availableQty'], SUPPLIER: ['externalId', 'supplierCode', 'name'],
  CUSTOMER: ['externalId', 'customerCode', 'name'], OPEN_PO: ['supplierCode', 'currency', 'orderDate'],
  FX: ['baseCurrency', 'quoteCurrency', 'rate', 'effectiveDate', 'source'],
}

export const TARGET_FIELDS: Record<DatasetType, string[]> = {
  MATERIAL: ['externalId', 'materialCode', 'internalPn', 'manufacturer', 'mpn', 'description', 'specification', 'unit', 'lifecycle', 'status', 'updatedAt'],
  INVENTORY: ['externalId', 'materialCode', 'warehouseCode', 'warehouseName', 'customerCode', 'onHandQty', 'availableQty', 'reservedQty', 'lotNo', 'updatedAt'],
  EXCESS: ['externalId', 'materialCode', 'customerCode', 'warehouseCode', 'bookQty', 'availableQty', 'earliestInboundAt', 'sourceDocumentId', 'sourceUpdatedAt'],
  SUPPLIER: ['externalId', 'supplierCode', 'name', 'status', 'currency', 'updatedAt'],
  CUSTOMER: ['externalId', 'customerCode', 'name', 'status', 'updatedAt'],
  OPEN_PO: ['externalId', 'poNumber', 'supplierCode', 'currency', 'orderDate', 'requestedDate', 'status'],
  FX: ['baseCurrency', 'quoteCurrency', 'rate', 'rateType', 'effectiveDate', 'source'],
}

export function suggestMappings(columns: string[], datasetType: DatasetType) {
  const targets = TARGET_FIELDS[datasetType]
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
  return columns.map(sourceColumn => {
    const normalized = normalize(sourceColumn)
    const exact = targets.find(target => normalize(target) === normalized)
    const aliases: Record<string, string> = { 物料编码: 'materialCode', 物料号: 'materialCode', 数量: 'onHandQty', 可用数量: 'availableQty', 供应商编码: 'supplierCode', 供应商名称: 'name', 客户编码: 'customerCode', 客户名称: 'name', 汇率: 'rate', 币种: 'quoteCurrency' }
    return { sourceColumn, targetField: exact ?? aliases[sourceColumn] ?? '' }
  })
}

export function importRows(dataset: SimulatorDataset, type: DatasetType, rows: Record<string, unknown>[], mappings: MappingProfile['mappings'], replace = false): { dataset: SimulatorDataset; report: ImportReport } {
  const output = structuredClone(dataset)
  const errors: string[] = []
  const brokenReferences: ImportReport['brokenReferences'] = []
  const mapped = rows.map((row, index) => {
    const item: Record<string, unknown> = {}
    for (const mapping of mappings) if (mapping.targetField) item[mapping.targetField] = row[mapping.sourceColumn] === undefined ? '' : String(row[mapping.sourceColumn])
    for (const field of requiredFields[type]) if (!item[field]) errors.push(`第 ${index + 2} 行缺少必填字段 ${field}`)
    return item
  }).filter((_, index) => !errors.some(error => error.startsWith(`第 ${index + 2} 行`)))

  mapped.forEach((item, index) => {
    if (['INVENTORY', 'EXCESS'].includes(type) && !output.materials.some(material => material.materialCode === item.materialCode)) brokenReferences.push({ type: 'Material', value: String(item.materialCode), row: index + 2 })
    if (type === 'OPEN_PO' && !output.suppliers.some(supplier => supplier.supplierCode === item.supplierCode)) brokenReferences.push({ type: 'Supplier', value: String(item.supplierCode), row: index + 2 })
  })

  if (brokenReferences.length === 0) {
    const key: Record<DatasetType, keyof SimulatorDataset> = { MATERIAL: 'materials', INVENTORY: 'inventory', EXCESS: 'excess', SUPPLIER: 'suppliers', CUSTOMER: 'customers', OPEN_PO: 'purchaseOrders', FX: 'exchangeRates' }
    const field = key[type]
    ;(output as any)[field] = replace ? mapped : [...(output as any)[field], ...mapped]
    output.datasetName = `Imported snapshot · ${new Date().toLocaleDateString('zh-CN')}`
  }

  return { dataset: output, report: { datasetType: type, rowsRead: rows.length, rowsImported: brokenReferences.length ? 0 : mapped.length, errors, brokenReferences } }
}
