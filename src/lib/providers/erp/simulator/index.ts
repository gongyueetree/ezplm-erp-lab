import type { ErpProvider } from '../contracts'
import type {
  AuditEntry,
  ErpCustomer,
  ErpEtaUpdate,
  ErpExchangeRate,
  ErpExcess,
  ErpInventory,
  ErpMaterial,
  ErpPurchaseOrder,
  ErpRequestLog,
  ErpSimScenario,
  ErpSupplier,
  ErpWriteResult,
  PullOptions,
  SimulatorDataset,
} from '../types'
import { ErpProviderError } from '../types'
import type { SimulatorRepository } from './repository'
import { beforeOperation } from './scenario-engine'

const uid = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
const clone = <T,>(value: T): T => structuredClone(value)

export class KingdeeSimulatorProvider implements ErpProvider {
  constructor(private repository: SimulatorRepository) {}

  getDataset() { return this.repository.load() }
  resetDataset() { return this.repository.reset() }
  replaceDataset(dataset: SimulatorDataset) { return this.repository.save(dataset) }

  async setScenario(scenario: ErpSimScenario) {
    const dataset = await this.repository.load()
    dataset.scenario = clone(scenario)
    await this.repository.save(dataset)
  }

  private async execute<T>(operation: string, payload: unknown, action: (dataset: SimulatorDataset) => T | Promise<T>): Promise<T> {
    const started = Date.now()
    const requestId = uid()
    const dataset = await this.repository.load()
    try {
      await beforeOperation(dataset.scenario, operation)
      const response = await action(dataset)
      this.addLog(dataset, { operation, requestId, payload, response, started, result: 'SUCCESS' })
      await this.repository.save(dataset)
      return clone(response)
    } catch (error) {
      const normalized = error instanceof ErpProviderError ? error : new ErpProviderError('UNEXPECTED_ERROR', error instanceof Error ? error.message : 'Unknown error')
      const latest = await this.repository.load()
      this.addLog(latest, { operation, requestId, payload, started, result: 'FAILED', error: normalized })
      await this.repository.save(latest)
      throw normalized
    }
  }

  private addLog(dataset: SimulatorDataset, input: { operation: string; requestId: string; payload: unknown; response?: unknown; started: number; result: ErpRequestLog['result']; error?: ErpProviderError }) {
    dataset.requestLogs.unshift({
      id: uid(), tenantId: dataset.tenantId, timestamp: new Date().toISOString(), operation: input.operation,
      requestId: input.requestId, attempt: 1, requestPayload: input.payload, responsePayload: input.response,
      latency: Date.now() - input.started, scenario: dataset.scenario.code, result: input.result,
      errorCode: input.error?.code, errorMessage: input.error?.message,
    })
    dataset.requestLogs = dataset.requestLogs.slice(0, 250)
  }

  private addAudit(dataset: SimulatorDataset, entry: Omit<AuditEntry, 'id' | 'tenantId' | 'timestamp'>) {
    dataset.auditLogs.unshift({ id: uid(), tenantId: dataset.tenantId, timestamp: new Date().toISOString(), ...entry })
    dataset.auditLogs = dataset.auditLogs.slice(0, 250)
  }

  async testConnection() {
    return this.execute('testConnection', {}, dataset => ({ connected: true, provider: 'simulator', message: `Simulator ready · ${dataset.datasetName}`, checkedAt: new Date().toISOString() }))
  }

  async pullMaterials(input: PullOptions = {}): Promise<ErpMaterial[]> {
    return this.execute('pullMaterials', input, dataset => {
      let rows = dataset.materials
      if (dataset.scenario.code === 'MATERIAL_NOT_FOUND') rows = rows.slice(1)
      if (dataset.scenario.code === 'PARTIAL_RESPONSE') rows = rows.slice(0, Math.max(1, Math.floor(rows.length / 2)))
      return rows.slice(0, input.limit ?? rows.length)
    })
  }

  async pullInventory(input: PullOptions = {}): Promise<ErpInventory[]> {
    return this.execute('pullInventory', input, dataset => this.partial(dataset.inventory, dataset, input.limit))
  }

  async pullExcess(input: PullOptions = {}): Promise<ErpExcess[]> {
    return this.execute('pullExcess', input, dataset => this.partial(dataset.excess, dataset, input.limit))
  }

  async pullSuppliers(input: PullOptions = {}): Promise<ErpSupplier[]> {
    return this.execute('pullSuppliers', input, dataset => this.partial(dataset.suppliers, dataset, input.limit))
  }

  async pullCustomers(input: PullOptions = {}): Promise<ErpCustomer[]> {
    return this.execute('pullCustomers', input, dataset => this.partial(dataset.customers, dataset, input.limit))
  }

  async pullExchangeRates(input: PullOptions = {}): Promise<ErpExchangeRate[]> {
    return this.execute('pullExchangeRates', input, dataset => dataset.scenario.code === 'FX_MISSING' ? [] : this.partial(dataset.exchangeRates, dataset, input.limit))
  }

  async pullOpenPurchaseOrders(input: PullOptions = {}): Promise<ErpPurchaseOrder[]> {
    return this.execute('pullOpenPurchaseOrders', input, dataset => this.partial(dataset.purchaseOrders.filter(po => po.status !== 'CLOSED'), dataset, input.limit))
  }

  private partial<T>(rows: T[], dataset: SimulatorDataset, limit?: number) {
    const selected = dataset.scenario.code === 'PARTIAL_RESPONSE' ? rows.slice(0, Math.max(1, Math.floor(rows.length / 2))) : rows
    return selected.slice(0, limit ?? selected.length)
  }

  async createPurchaseOrder(input: ErpPurchaseOrder, idempotencyKey: string): Promise<ErpWriteResult> {
    if (!idempotencyKey.trim()) throw new ErpProviderError('IDEMPOTENCY_KEY_REQUIRED', '创建 PO 必须提供 Idempotency-Key', false, 400)
    const existingDataset = await this.repository.load()
    const existing = existingDataset.purchaseOrders.find(po => po.idempotencyKey === idempotencyKey)
    if (existing) {
      return this.execute('createPurchaseOrder', { input, idempotencyKey, replay: true }, dataset => {
        this.addAudit(dataset, { actor: 'erp-lab-user', action: 'PO_IDEMPOTENT_REPLAY', entityType: 'PURCHASE_ORDER', entityId: existing.externalId, result: 'SUCCESS', details: idempotencyKey })
        return { success: true, externalId: existing.externalId, documentNumber: existing.poNumber, idempotentReplay: true, message: '返回首次创建的采购单' }
      })
    }

    return this.execute('createPurchaseOrder', { input, idempotencyKey }, async dataset => {
      const supplier = dataset.suppliers.find(item => item.supplierCode === input.supplierCode)
      if (!supplier) throw new ErpProviderError('SUPPLIER_NOT_FOUND', `供应商 ${input.supplierCode} 不存在`, false, 422)
      const missingMaterial = input.lines.find(line => !dataset.materials.some(item => item.materialCode === line.materialCode))
      if (missingMaterial) throw new ErpProviderError('MATERIAL_NOT_FOUND', `物料 ${missingMaterial.materialCode} 不存在`, false, 422)

      const sequence = dataset.purchaseOrders.length + 1
      const po: ErpPurchaseOrder = {
        ...clone(input), externalId: `SIM-PO-${String(sequence).padStart(5, '0')}`,
        poNumber: `SIM${new Date().toISOString().slice(0, 10).replaceAll('-', '')}${String(sequence).padStart(3, '0')}`,
        status: 'OPEN', idempotencyKey,
      }
      dataset.purchaseOrders.push(po)
      this.addAudit(dataset, { actor: 'erp-lab-user', action: 'CREATE_PO', entityType: 'PURCHASE_ORDER', entityId: po.externalId, result: 'SUCCESS', details: `Idempotency-Key: ${idempotencyKey}` })

      if (dataset.scenario.code === 'NETWORK_DROP_AFTER_COMMIT') {
        await this.repository.save(dataset)
        const committed = await this.repository.load()
        this.addLog(committed, { operation: 'createPurchaseOrder', requestId: uid(), payload: { input, idempotencyKey }, response: { externalId: po.externalId }, started: Date.now(), result: 'COMMITTED_NO_RESPONSE' })
        await this.repository.save(committed)
        throw new ErpProviderError('NETWORK_DROP_AFTER_COMMIT', 'PO 已在 ERP 提交，但网络在返回响应前断开；请使用相同 Idempotency-Key 重试', true, 503)
      }
      return { success: true, externalId: po.externalId, documentNumber: po.poNumber, idempotentReplay: false, message: '采购单已创建' }
    })
  }

  async updateEta(input: ErpEtaUpdate): Promise<ErpWriteResult> {
    return this.execute('updateEta', input, dataset => {
      const po = dataset.purchaseOrders.find(item => item.externalId === input.poExternalId || item.poNumber === input.poNumber)
      if (!po) throw new ErpProviderError('PO_NOT_FOUND', '采购单不存在', false, 404)
      const line = po.lines.find(item => item.lineNo === input.lineNo)
      if (!line) throw new ErpProviderError('PO_LINE_NOT_FOUND', `采购单行 ${input.lineNo} 不存在`, false, 404)
      if (input.confirmedQty !== undefined) line.confirmedQty = input.confirmedQty
      if (input.eta !== undefined) line.eta = input.eta
      if (input.shipDate !== undefined) line.shipDate = input.shipDate
      this.addAudit(dataset, { actor: 'erp-lab-user', action: 'UPDATE_ETA', entityType: 'PURCHASE_ORDER_LINE', entityId: `${po.externalId}:${line.lineNo}`, result: 'SUCCESS', details: input.eta })
      return { success: true, externalId: po.externalId, documentNumber: po.poNumber, message: 'ETA 已更新' }
    })
  }
}
