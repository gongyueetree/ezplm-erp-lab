import { createSeedDataset } from './seed.js'
import type { ErpRequestLog, ErpSimScenario, SimulatorDataset } from '../types.js'
import {
  memQueryCustomers,
  memQueryExcess,
  memQueryFx,
  memQueryInventory,
  memQueryMaterials,
  memQueryOpenPos,
  memQueryLots,
  memQueryMovements,
  memQuerySalesOrders,
  memQuerySuppliers,
  memQueryWorkOrders,
  type PagedRows,
  type PageQuery,
} from './query.js'
import type {
  ErpCustomer,
  ErpExcess,
  ErpExchangeRate,
  ErpInventory,
  ErpInventoryLot,
  ErpInventoryMovement,
  ErpMaterial,
  ErpPurchaseOrder,
  ErpSalesOrder,
  ErpSupplier,
  ErpWorkOrder,
} from '../types.js'

export interface SimulatorRepository {
  load(): Promise<SimulatorDataset>
  save(dataset: SimulatorDataset): Promise<void>
  reset(): Promise<SimulatorDataset>
  /** closed-loop: 轻量读场景(pull 路径不再整库加载) */
  getScenario(): Promise<ErpSimScenario>
  /** closed-loop: 追加请求日志(不重写整个数据集) */
  appendRequestLog(entry: ErpRequestLog): Promise<void>
  // closed-loop: 分页查询 —— Prisma 实现走 DB where/skip/take,内存实现走 query.ts
  queryMaterials(q: PageQuery): Promise<PagedRows<ErpMaterial>>
  queryInventory(q: PageQuery): Promise<PagedRows<ErpInventory>>
  queryExcess(q: PageQuery): Promise<PagedRows<ErpExcess>>
  querySuppliers(q: PageQuery): Promise<PagedRows<ErpSupplier>>
  queryCustomers(q: PageQuery): Promise<PagedRows<ErpCustomer>>
  queryExchangeRates(q: PageQuery): Promise<PagedRows<ErpExchangeRate>>
  queryOpenPurchaseOrders(q: PageQuery): Promise<PagedRows<ErpPurchaseOrder>>
  queryWorkOrders(q: PageQuery): Promise<PagedRows<ErpWorkOrder>>
  querySalesOrders(q: PageQuery): Promise<PagedRows<ErpSalesOrder>>
  queryMovements(q: PageQuery): Promise<PagedRows<ErpInventoryMovement>>
  queryLots(q: PageQuery): Promise<PagedRows<ErpInventoryLot>>
}

/** 内存查询混入:Memory/Browser 仓储共用(数据量小,语义与 DB 版一致) */
async function memQueries(repo: { load(): Promise<SimulatorDataset> }) {
  const dataset = await repo.load()
  return dataset
}

const REQUEST_LOG_CAP = 250

abstract class InMemoryQueryBase implements Pick<SimulatorRepository,
  'queryMaterials' | 'queryInventory' | 'queryExcess' | 'querySuppliers' | 'queryCustomers' |
  'queryExchangeRates' | 'queryOpenPurchaseOrders' | 'queryWorkOrders' | 'querySalesOrders' |
  'queryMovements' | 'queryLots' |
  'getScenario' | 'appendRequestLog'> {
  abstract load(): Promise<SimulatorDataset>
  abstract save(dataset: SimulatorDataset): Promise<void>

  async getScenario() { return (await this.load()).scenario }
  async appendRequestLog(entry: ErpRequestLog) {
    const dataset = await this.load()
    dataset.requestLogs.unshift(entry)
    dataset.requestLogs = dataset.requestLogs.slice(0, REQUEST_LOG_CAP)
    await this.save(dataset)
  }
  async queryMaterials(q: PageQuery) { return memQueryMaterials((await memQueries(this)).materials, q) }
  async queryInventory(q: PageQuery) { return memQueryInventory((await memQueries(this)).inventory, q) }
  async queryExcess(q: PageQuery) { return memQueryExcess((await memQueries(this)).excess, q) }
  async querySuppliers(q: PageQuery) { return memQuerySuppliers((await memQueries(this)).suppliers, q) }
  async queryCustomers(q: PageQuery) { return memQueryCustomers((await memQueries(this)).customers, q) }
  async queryExchangeRates(q: PageQuery) { return memQueryFx((await memQueries(this)).exchangeRates, q) }
  async queryOpenPurchaseOrders(q: PageQuery) { return memQueryOpenPos((await memQueries(this)).purchaseOrders, q) }
  async queryWorkOrders(q: PageQuery) { return memQueryWorkOrders((await memQueries(this)).workOrders ?? [], q) }
  async querySalesOrders(q: PageQuery) { return memQuerySalesOrders((await memQueries(this)).salesOrders ?? [], q) }
  async queryMovements(q: PageQuery) { return memQueryMovements((await memQueries(this)).movements ?? [], q) }
  async queryLots(q: PageQuery) { return memQueryLots((await memQueries(this)).lots ?? [], q) }
}

export class MemorySimulatorRepository extends InMemoryQueryBase implements SimulatorRepository {
  private dataset: SimulatorDataset

  constructor(public readonly tenantId = 'ezplm-demo', initial?: SimulatorDataset) {
    super()
    this.dataset = structuredClone(initial ?? createSeedDataset(tenantId))
  }

  async load() { return structuredClone(this.dataset) }
  async save(dataset: SimulatorDataset) { this.dataset = structuredClone(dataset) }
  async reset() {
    this.dataset = createSeedDataset(this.tenantId)
    return this.load()
  }
}

export class BrowserSimulatorRepository extends InMemoryQueryBase implements SimulatorRepository {
  private readonly key: string

  constructor(public readonly tenantId = 'ezplm-demo') {
    super()
    this.key = `ezplm:erp-lab:v2:${tenantId}`
  }

  async load(): Promise<SimulatorDataset> {
    const raw = localStorage.getItem(this.key)
    if (!raw) return this.reset()
    try {
      const parsed = JSON.parse(raw) as SimulatorDataset
      if (parsed.tenantId !== this.tenantId) return this.reset()
      return parsed
    } catch {
      return this.reset()
    }
  }

  async save(dataset: SimulatorDataset) {
    if (dataset.tenantId !== this.tenantId) throw new Error('Tenant isolation violation')
    localStorage.setItem(this.key, JSON.stringify(dataset))
  }

  async reset() {
    const dataset = createSeedDataset(this.tenantId)
    await this.save(dataset)
    return dataset
  }
}
