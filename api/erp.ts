import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { DatasetType, ErpPurchaseOrder, ErpSimScenario, SimulatorDataset } from '../src/lib/providers/erp/types'

class ApiError extends Error {
  constructor(public code: string, message: string, public retryable = false, public httpStatus = 500) { super(message) }
}

type MaintainableType = Exclude<DatasetType, 'OPEN_PO'>
const fields: Record<MaintainableType, keyof SimulatorDataset> = {
  MATERIAL: 'materials', INVENTORY: 'inventory', EXCESS: 'excess', SUPPLIER: 'suppliers', CUSTOMER: 'customers', FX: 'exchangeRates',
}
const required: Record<MaintainableType, string[]> = {
  MATERIAL: ['externalId', 'materialCode'], INVENTORY: ['externalId', 'materialCode', 'onHandQty'], EXCESS: ['externalId', 'materialCode', 'bookQty', 'availableQty'],
  SUPPLIER: ['externalId', 'supplierCode', 'name'], CUSTOMER: ['externalId', 'customerCode', 'name'], FX: ['baseCurrency', 'quoteCurrency', 'rate', 'effectiveDate', 'source'],
}
const recordKey = (type: MaintainableType, record: Record<string, unknown>) => type === 'FX'
  ? [record.baseCurrency, record.quoteCurrency, record.effectiveDate].join('|')
  : String(record.externalId || '')

function validateRecord(type: MaintainableType, record: Record<string, unknown>, dataset: SimulatorDataset) {
  for (const field of required[type]) if (!String(record[field] ?? '').trim()) throw new ApiError('VALIDATION_ERROR', `必填字段 ${field} 不能为空`, false, 422)
  if (['INVENTORY', 'EXCESS'].includes(type) && !dataset.materials.some(row => row.materialCode === record.materialCode)) throw new ApiError('BROKEN_REFERENCE', `物料 ${record.materialCode} 不存在`, false, 422)
  for (const field of ['onHandQty', 'availableQty', 'reservedQty', 'bookQty', 'rate']) {
    if (record[field] !== undefined && record[field] !== '' && !/^-?\d+(\.\d+)?$/.test(String(record[field]))) throw new ApiError('INVALID_DECIMAL', `${field} 必须是 Decimal String`, false, 422)
  }
}

function addMaintenanceAudit(dataset: SimulatorDataset, action: string, type: MaintainableType, key: string) {
  dataset.auditLogs.unshift({ id: crypto.randomUUID(), tenantId: dataset.tenantId, timestamp: new Date().toISOString(), actor: 'erp-lab-user', action, entityType: type, entityId: key, result: 'SUCCESS' })
  dataset.auditLogs = dataset.auditLogs.slice(0, 250)
}

const tenantFrom = (req: VercelRequest) => String(req.query.tenantId || req.body?.tenantId || req.headers['x-tenant-id'] || 'ezplm-demo')

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (!process.env.DATABASE_URL) throw new ApiError('DATABASE_NOT_CONFIGURED', '服务端尚未配置 DATABASE_URL，请先连接 PostgreSQL 并执行 Prisma migration。', false, 503)
    const tenantId = tenantFrom(req)
    if (req.method === 'POST' && process.env.NODE_ENV === 'production') {
      const configuredToken = process.env.ERP_LAB_ACCESS_TOKEN
      if (!configuredToken) throw new ApiError('ERP_LAB_ACCESS_TOKEN_NOT_CONFIGURED', '服务端尚未配置 ERP_LAB_ACCESS_TOKEN', false, 503)
      if (req.headers.authorization !== `Bearer ${configuredToken}`) throw new ApiError('ERP_LAB_UNAUTHORIZED', '需要有效的 ERP Lab 管理凭证', false, 401)
    }
    const [{ KingdeeSimulatorProvider }, { PrismaSimulatorRepository }] = await Promise.all([
      import('../src/lib/providers/erp/simulator'), import('../server/prisma-simulator-repository'),
    ])
    const provider = new KingdeeSimulatorProvider(new PrismaSimulatorRepository(tenantId))
    if (req.method === 'GET') return res.status(200).json({ ok: true, data: await provider.getDataset() })
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET or POST' } })

    const { operation, payload = {} } = req.body ?? {}
    let data: unknown
    switch (operation) {
      case 'resetDataset': data = await provider.resetDataset(); break
      case 'replaceDataset': await provider.replaceDataset(payload.dataset as SimulatorDataset); data = await provider.getDataset(); break
      case 'setScenario': await provider.setScenario(payload.scenario as ErpSimScenario); data = await provider.getDataset(); break
      case 'testConnection': data = await provider.testConnection(); break
      case 'pullMaterials': data = await provider.pullMaterials(payload.input); break
      case 'pullInventory': data = await provider.pullInventory(payload.input); break
      case 'pullExcess': data = await provider.pullExcess(payload.input); break
      case 'pullSuppliers': data = await provider.pullSuppliers(payload.input); break
      case 'pullCustomers': data = await provider.pullCustomers(payload.input); break
      case 'pullExchangeRates': data = await provider.pullExchangeRates(payload.input); break
      case 'pullOpenPurchaseOrders': data = await provider.pullOpenPurchaseOrders(payload.input); break
      case 'createPurchaseOrder': data = await provider.createPurchaseOrder(payload.input as ErpPurchaseOrder, String(payload.idempotencyKey || '')); break
      case 'updateEta': data = await provider.updateEta(payload.input); break
      case 'upsertRecord': {
        const type = payload.type as MaintainableType
        if (!fields[type]) throw new ApiError('INVALID_DATASET_TYPE', '该数据集不能通过通用编辑器维护', false, 400)
        const dataset = await provider.getDataset()
        const record = payload.record as Record<string, unknown>
        validateRecord(type, record, dataset)
        const collection = dataset[fields[type]] as unknown as Record<string, unknown>[]
        const originalKey = String(payload.originalKey || recordKey(type, record))
        const index = collection.findIndex(row => recordKey(type, row) === originalKey)
        if (index >= 0) collection[index] = record; else collection.push(record)
        addMaintenanceAudit(dataset, index >= 0 ? 'UPDATE_RECORD' : 'CREATE_RECORD', type, recordKey(type, record))
        await provider.replaceDataset(dataset); data = await provider.getDataset(); break
      }
      case 'deleteRecord': {
        const type = payload.type as MaintainableType
        if (!fields[type]) throw new ApiError('INVALID_DATASET_TYPE', '该数据集不能通过通用编辑器维护', false, 400)
        const dataset = await provider.getDataset()
        const key = String(payload.key || '')
        if (type === 'MATERIAL' && [...dataset.inventory, ...dataset.excess].some(row => row.materialCode === dataset.materials.find(item => item.externalId === key)?.materialCode)) throw new ApiError('RECORD_IN_USE', '该物料仍被库存或 Excess 引用，不能删除', false, 409)
        const collection = dataset[fields[type]] as unknown as Record<string, unknown>[]
        const index = collection.findIndex(row => recordKey(type, row) === key)
        if (index < 0) throw new ApiError('RECORD_NOT_FOUND', '记录不存在或已被删除', false, 404)
        collection.splice(index, 1)
        addMaintenanceAudit(dataset, 'DELETE_RECORD', type, key)
        await provider.replaceDataset(dataset); data = await provider.getDataset(); break
      }
      default: throw new ApiError('UNKNOWN_OPERATION', `Unknown ERP operation: ${operation}`, false, 400)
    }
    return res.status(200).json({ ok: true, data })
  } catch (error) {
    const candidate = error as Partial<ApiError>
    const normalized = typeof candidate?.code === 'string' && typeof candidate?.httpStatus === 'number'
      ? candidate as ApiError
      : new ApiError('DATABASE_OR_SERVER_ERROR', error instanceof Error ? error.message : 'Unknown server error', true, 500)
    return res.status(normalized.httpStatus).json({ ok: false, error: { code: normalized.code, message: normalized.message, retryable: normalized.retryable } })
  }
}
