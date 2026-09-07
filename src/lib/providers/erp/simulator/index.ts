import type { ErpProvider } from '../contracts.js'
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
  ErpPullPage,
  ErpReceiveInput,
  ErpSalesOrder,
  ErpSimScenario,
  ErpSupplier,
  ErpWorkOrder,
  ErpWriteResult,
  PullOptions,
  SimulatorDataset,
} from '../types.js'
import { ErpProviderError } from '../types.js'
import type { SimulatorRepository } from './repository.js'
import { beforeOperation } from './scenario-engine.js'
import { pageEnvelope, toPageQuery, type PageQuery } from './query.js'

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

  /** closed-loop: 主系统经 X-Correlation-Id 传入;写进每条请求日志 */
  correlationId?: string

  /**
   * closed-loop: pull 专用轻量通道 —— 只读场景 + 查询层分页,**不整库加载**。
   * 写操作(createPurchaseOrder/updateEta/receive)仍走 execute() 的整库事务语义。
   */
  private async executePull<T>(operation: string, payload: unknown, action: (q: PageQuery) => Promise<T>, q: PageQuery): Promise<T> {
    const started = Date.now()
    const requestId = uid()
    const scenario = await this.repository.getScenario()
    try {
      await beforeOperation(scenario, operation)
      const response = await action(q)
      await this.repository.appendRequestLog({
        id: uid(), tenantId: this.tenantId(), timestamp: new Date().toISOString(), operation,
        requestId, correlationId: this.correlationId, attempt: 1, requestPayload: payload, responsePayload: undefined,
        latency: Date.now() - started, scenario: scenario.code, result: 'SUCCESS',
      })
      return response
    } catch (error) {
      const normalized = error instanceof ErpProviderError ? error : new ErpProviderError('UNEXPECTED_ERROR', error instanceof Error ? error.message : 'Unknown error')
      await this.repository.appendRequestLog({
        id: uid(), tenantId: this.tenantId(), timestamp: new Date().toISOString(), operation,
        requestId, correlationId: this.correlationId, attempt: 1, requestPayload: payload, responsePayload: undefined,
        latency: Date.now() - started, scenario: scenario.code, result: 'FAILED',
        errorCode: normalized.code, errorMessage: normalized.message,
      })
      throw normalized
    }
  }

  private tenantId(): string {
    return (this.repository as { tenantId?: string }).tenantId ?? 'ezplm-demo'
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
      requestId: input.requestId, correlationId: this.correlationId, attempt: 1, requestPayload: input.payload, responsePayload: input.response,
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

  // ---- closed-loop: pull* 全部走查询层(服务端过滤 + 分页信封) ----

  async pullMaterials(input: PullOptions = {}): Promise<ErpPullPage<ErpMaterial>> {
    const q = toPageQuery(input)
    return this.executePull('pullMaterials', input, async () => {
      const scenario = await this.repository.getScenario()
      const paged = await this.repository.queryMaterials(q)
      // 场景语义保持:MATERIAL_NOT_FOUND 隐藏首页第一条;PARTIAL_RESPONSE 砍半
      if (scenario.enabled && scenario.code === 'MATERIAL_NOT_FOUND' && q.offset === 0) {
        paged.items = paged.items.slice(1)
      }
      if (scenario.enabled && scenario.code === 'PARTIAL_RESPONSE') {
        paged.items = paged.items.slice(0, Math.max(1, Math.floor(paged.items.length / 2)))
      }
      return pageEnvelope(paged, q)
    }, q)
  }

  async pullInventory(input: PullOptions = {}): Promise<ErpPullPage<ErpInventory>> {
    const q = toPageQuery(input)
    return this.executePull('pullInventory', input, async () => pageEnvelope(await this.partialPage(await this.repository.queryInventory(q)), q), q)
  }

  async pullExcess(input: PullOptions = {}): Promise<ErpPullPage<ErpExcess>> {
    const q = toPageQuery(input)
    return this.executePull('pullExcess', input, async () => pageEnvelope(await this.partialPage(await this.repository.queryExcess(q)), q), q)
  }

  async pullSuppliers(input: PullOptions = {}): Promise<ErpPullPage<ErpSupplier>> {
    const q = toPageQuery(input)
    return this.executePull('pullSuppliers', input, async () => pageEnvelope(await this.partialPage(await this.repository.querySuppliers(q)), q), q)
  }

  async pullCustomers(input: PullOptions = {}): Promise<ErpPullPage<ErpCustomer>> {
    const q = toPageQuery(input)
    return this.executePull('pullCustomers', input, async () => pageEnvelope(await this.partialPage(await this.repository.queryCustomers(q)), q), q)
  }

  async pullExchangeRates(input: PullOptions = {}): Promise<ErpPullPage<ErpExchangeRate>> {
    const q = toPageQuery(input)
    return this.executePull('pullExchangeRates', input, async () => {
      const scenario = await this.repository.getScenario()
      if (scenario.enabled && scenario.code === 'FX_MISSING') return pageEnvelope({ items: [], total: 0 }, q)
      return pageEnvelope(await this.partialPage(await this.repository.queryExchangeRates(q)), q)
    }, q)
  }

  async pullOpenPurchaseOrders(input: PullOptions = {}): Promise<ErpPullPage<ErpPurchaseOrder>> {
    const q = toPageQuery(input)
    return this.executePull('pullOpenPurchaseOrders', input, async () => pageEnvelope(await this.partialPage(await this.repository.queryOpenPurchaseOrders(q)), q), q)
  }

  async pullWorkOrders(input: PullOptions = {}): Promise<ErpPullPage<ErpWorkOrder>> {
    const q = toPageQuery(input)
    return this.executePull('pullWorkOrders', input, async () => pageEnvelope(await this.partialPage(await this.repository.queryWorkOrders(q)), q), q)
  }

  async pullSalesOrders(input: PullOptions = {}): Promise<ErpPullPage<ErpSalesOrder>> {
    const q = toPageQuery(input)
    return this.executePull('pullSalesOrders', input, async () => pageEnvelope(await this.partialPage(await this.repository.querySalesOrders(q)), q), q)
  }

  /** PARTIAL_RESPONSE 场景:当前页砍半(与旧语义一致,只作用于返回条数) */
  private async partialPage<T>(paged: { items: T[]; total: number }): Promise<{ items: T[]; total: number }> {
    const scenario = await this.repository.getScenario()
    if (scenario.enabled && scenario.code === 'PARTIAL_RESPONSE') {
      return { items: paged.items.slice(0, Math.max(1, Math.floor(paged.items.length / 2))), total: paged.total }
    }
    return paged
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

  /**
   * closed-loop: 收货。幂等键防重复;更新 PO 行 receivedQty、推进 PO 状态、
   * 库存按 (materialCode, warehouse, lotNo) 增加或建行、落 Receipt 单据。
   */
  async receivePurchaseOrder(input: ErpReceiveInput, idempotencyKey: string): Promise<ErpWriteResult> {
    if (!idempotencyKey.trim()) throw new ErpProviderError('IDEMPOTENCY_KEY_REQUIRED', '收货必须提供 Idempotency-Key', false, 400)
    const existingDataset = await this.repository.load()
    const existing = existingDataset.receipts.find(r => r.idempotencyKey === idempotencyKey)
    if (existing) {
      return this.execute('receivePurchaseOrder', { input, idempotencyKey, replay: true }, dataset => {
        this.addAudit(dataset, { actor: 'erp-lab-user', action: 'RECEIPT_IDEMPOTENT_REPLAY', entityType: 'RECEIPT', entityId: existing.externalId, result: 'SUCCESS', details: idempotencyKey })
        return { success: true, externalId: existing.externalId, documentNumber: existing.receiptNumber, idempotentReplay: true, message: '返回首次创建的收货单' }
      })
    }

    return this.execute('receivePurchaseOrder', { input, idempotencyKey }, async dataset => {
      const po = dataset.purchaseOrders.find(item => item.externalId === input.poExternalId || item.poNumber === input.poNumber)
      if (!po) throw new ErpProviderError('PO_NOT_FOUND', '采购单不存在', false, 404)
      if (!input.lines.length) throw new ErpProviderError('VALIDATION_ERROR', '收货至少一行', false, 422)

      const receiptLines = []
      for (const l of input.lines) {
        const line = po.lines.find(item => item.lineNo === l.lineNo)
        if (!line) throw new ErpProviderError('PO_LINE_NOT_FOUND', `采购单行 ${l.lineNo} 不存在`, false, 404)
        if (!/^\d+(\.\d+)?$/.test(l.qty) || Number(l.qty) <= 0) throw new ErpProviderError('INVALID_DECIMAL', `收货数量 ${l.qty} 非法`, false, 422)
        line.receivedQty = String(Number(line.receivedQty ?? '0') + Number(l.qty))
        receiptLines.push({ lineNo: l.lineNo, materialCode: line.materialCode, qty: l.qty, lotNo: l.lotNo, warehouseCode: l.warehouseCode })

        // 库存:同 (materialCode, warehouse, lotNo) 增量,否则建行
        const wh = l.warehouseCode ?? 'RECV'
        const inv = dataset.inventory.find(row => row.materialCode === line.materialCode && (row.warehouseCode ?? '') === wh && (row.lotNo ?? '') === (l.lotNo ?? ''))
        if (inv) {
          inv.onHandQty = String(Number(inv.onHandQty) + Number(l.qty))
          inv.availableQty = String(Number(inv.availableQty ?? inv.onHandQty))
          inv.updatedAt = new Date().toISOString()
        } else {
          dataset.inventory.push({ externalId: `INV-RCV-${uid().slice(0, 8)}`, materialCode: line.materialCode, warehouseCode: wh, warehouseName: wh, onHandQty: l.qty, availableQty: l.qty, reservedQty: '0', lotNo: l.lotNo, updatedAt: new Date().toISOString() })
        }
      }

      // PO 状态推进:全部行收满 → CLOSED;任一行有收货 → PARTIALLY_RECEIVED
      const allFull = po.lines.every(line => Number(line.receivedQty ?? '0') >= Number(line.qty))
      const anyReceived = po.lines.some(line => Number(line.receivedQty ?? '0') > 0)
      po.status = allFull ? 'CLOSED' : anyReceived ? 'PARTIALLY_RECEIVED' : po.status

      const sequence = dataset.receipts.length + 1
      const receipt = {
        externalId: `SIM-RCV-${String(sequence).padStart(5, '0')}`,
        receiptNumber: `RCV${new Date().toISOString().slice(0, 10).replaceAll('-', '')}${String(sequence).padStart(3, '0')}`,
        poExternalId: po.externalId!,
        poNumber: po.poNumber,
        receivedAt: new Date().toISOString(),
        idempotencyKey,
        lines: receiptLines,
      }
      dataset.receipts.push(receipt)
      this.addAudit(dataset, { actor: 'erp-lab-user', action: 'RECEIVE_PO', entityType: 'RECEIPT', entityId: receipt.externalId, result: 'SUCCESS', details: `PO ${po.poNumber} · ${receiptLines.length} 行 · Idempotency-Key: ${idempotencyKey}` })
      return { success: true, externalId: receipt.externalId, documentNumber: receipt.receiptNumber, idempotentReplay: false, message: `收货完成;PO 状态 ${po.status}` }
    })
  }
}
