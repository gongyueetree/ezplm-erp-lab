import { describe, expect, it } from 'vitest'
import { KingdeeSimulatorProvider } from '.'
import { MemorySimulatorRepository } from './repository.js'
import { createSeedDataset } from './seed.js'
import { importRows } from './importer.js'

const makeProvider = () => new KingdeeSimulatorProvider(new MemorySimulatorRepository('lab1-tenant'))

describe('LAB-1 · ErpProvider contract · WorkOrder / SalesOrder', () => {
  it('pullWorkOrders returns canonical work orders with decimal strings and consumed lines', async () => {
    const provider = makeProvider()
    const workOrders = await provider.pullWorkOrders()
    expect(workOrders.length).toBeGreaterThan(0)
    for (const wo of workOrders) {
      expect(typeof wo.qty).toBe('string')
      expect(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SHIPPED']).toContain(wo.status)
      expect(Array.isArray(wo.consumedLines)).toBe(true)
      for (const line of wo.consumedLines) expect(typeof line.consumedQty).toBe('string')
    }
  })

  it('pullSalesOrders returns canonical sales orders; shippedQty never exceeds qty in seed', async () => {
    const provider = makeProvider()
    const salesOrders = await provider.pullSalesOrders()
    expect(salesOrders.length).toBeGreaterThan(0)
    for (const so of salesOrders) {
      expect(so.customerCode.length).toBeGreaterThan(0)
      for (const line of so.lines) {
        expect(typeof line.qty).toBe('string')
        if (line.shippedQty !== undefined) expect(Number(line.shippedQty)).toBeLessThanOrEqual(Number(line.qty))
      }
    }
  })

  it('respects the limit option like other pull operations', async () => {
    const provider = makeProvider()
    expect((await provider.pullWorkOrders({ limit: 1 }))).toHaveLength(1)
    expect((await provider.pullSalesOrders({ limit: 1 }))).toHaveLength(1)
  })
})

describe('LAB-1 · WORK_ORDER_SOURCE_UNAVAILABLE — 部分数据源失败', () => {
  it('only pullWorkOrders fails; every other source keeps working', async () => {
    const provider = makeProvider()
    await provider.setScenario({ code: 'WORK_ORDER_SOURCE_UNAVAILABLE', enabled: true, latencyMs: 0, failureRate: 1 })

    await expect(provider.pullWorkOrders()).rejects.toMatchObject({
      code: 'WORK_ORDER_SOURCE_UNAVAILABLE',
      retryable: true,
    })

    // 其它数据源必须照常返回——消费方据此实现「部分降级」而不是整体黑屏
    expect((await provider.pullMaterials()).length).toBeGreaterThan(0)
    expect((await provider.pullInventory()).length).toBeGreaterThan(0)
    expect((await provider.pullSalesOrders()).length).toBeGreaterThan(0)
    expect((await provider.pullOpenPurchaseOrders()).length).toBeGreaterThan(0)
  })

  it('the failure is logged in request logs with its scenario', async () => {
    const provider = makeProvider()
    await provider.setScenario({ code: 'WORK_ORDER_SOURCE_UNAVAILABLE', enabled: true, latencyMs: 0, failureRate: 1 })
    await expect(provider.pullWorkOrders()).rejects.toBeTruthy()
    const logs = (await provider.getDataset()).requestLogs
    expect(logs.some(log => log.operation === 'pullWorkOrders' && log.result === 'FAILED' && log.errorCode === 'WORK_ORDER_SOURCE_UNAVAILABLE')).toBe(true)
  })
})

describe('LAB-1 · golden dataset 引用一致性', () => {
  const dataset = createSeedDataset('golden-check')

  it('every consumed line references an existing material', () => {
    const materialCodes = new Set(dataset.materials.map(material => material.materialCode))
    for (const wo of dataset.workOrders) {
      expect(wo.consumedLines.length).toBeGreaterThan(0)
      for (const line of wo.consumedLines) expect(materialCodes.has(line.materialCode)).toBe(true)
    }
  })

  it('every work order and sales order customerCode references an existing customer', () => {
    const customerCodes = new Set(dataset.customers.map(customer => customer.customerCode))
    for (const wo of dataset.workOrders) if (wo.customerCode) expect(customerCodes.has(wo.customerCode)).toBe(true)
    for (const so of dataset.salesOrders) expect(customerCodes.has(so.customerCode)).toBe(true)
  })

  it('excess sourceDocumentId cross-references seeded work orders where present', () => {
    const woNumbers = new Set(dataset.workOrders.map(wo => wo.woNumber))
    // WO-2841 / WO-2917 在 excess 里作为来源单据出现——两边必须指向同一批工单
    const referenced = dataset.excess.map(row => row.sourceDocumentId).filter((id): id is string => Boolean(id))
    expect(referenced.some(id => woNumbers.has(id))).toBe(true)
  })
})

describe('LAB-1 · snapshot import 引用校验', () => {
  it('blocks a sales order whose customer does not exist', () => {
    const dataset = createSeedDataset('import-check')
    const { report } = importRows(dataset, 'SALES_ORDER', [{ id: 'SO-X', so: 'SO123', cust: 'CUS-GHOST' }], [
      { sourceColumn: 'id', targetField: 'externalId' },
      { sourceColumn: 'so', targetField: 'soNumber' },
      { sourceColumn: 'cust', targetField: 'customerCode' },
    ])
    expect(report.brokenReferences).toHaveLength(1)
    expect(report.brokenReferences[0].type).toBe('Customer')
    expect(report.rowsImported).toBe(0)
  })

  it('imports a work order header with a valid customer; missing lines become an explicit empty array', () => {
    const dataset = createSeedDataset('import-check')
    const { dataset: output, report } = importRows(dataset, 'WORK_ORDER', [
      { id: 'WO-EXT-100', wo: 'WO-9001', product: 'FG-TEST-1', qty: '50', status: 'PLANNED', cust: 'CUS-ACME' },
    ], [
      { sourceColumn: 'id', targetField: 'externalId' },
      { sourceColumn: 'wo', targetField: 'woNumber' },
      { sourceColumn: 'product', targetField: 'productCode' },
      { sourceColumn: 'qty', targetField: 'qty' },
      { sourceColumn: 'status', targetField: 'status' },
      { sourceColumn: 'cust', targetField: 'customerCode' },
    ])
    expect(report.rowsImported).toBe(1)
    const imported = output.workOrders.find(wo => wo.externalId === 'WO-EXT-100')
    expect(imported?.consumedLines).toEqual([])
  })

  it('rejects a work order header missing required fields', () => {
    const dataset = createSeedDataset('import-check')
    const { report } = importRows(dataset, 'WORK_ORDER', [{ wo: 'WO-9002' }], [
      { sourceColumn: 'wo', targetField: 'woNumber' },
    ])
    expect(report.errors.length).toBeGreaterThan(0)
    expect(report.rowsImported).toBe(0)
  })
})
