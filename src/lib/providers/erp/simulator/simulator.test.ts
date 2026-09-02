import { describe, expect, it } from 'vitest'
import { KingdeeSimulatorProvider } from '.'
import { MemorySimulatorRepository } from './repository'

const makeProvider = () => new KingdeeSimulatorProvider(new MemorySimulatorRepository('test-tenant'))

describe('ErpProvider contract · Kingdee Simulator', () => {
  it('returns canonical master data and decimal strings', async () => {
    const provider = makeProvider()
    expect((await provider.testConnection()).connected).toBe(true)
    expect((await provider.pullMaterials()).length).toBeGreaterThan(0)
    const inventory = await provider.pullInventory()
    expect(inventory.length).toBeGreaterThan(0)
    expect(typeof inventory[0].onHandQty).toBe('string')
    expect((await provider.pullExcess()).length).toBeGreaterThan(0)
    expect((await provider.pullExchangeRates()).length).toBeGreaterThan(0)
    expect((await provider.pullOpenPurchaseOrders()).length).toBeGreaterThan(0)
  })

  it('requires an idempotency key for PO writes', async () => {
    const provider = makeProvider()
    await expect(provider.createPurchaseOrder({ supplierCode: 'SUP-DIGIKEY', currency: 'USD', orderDate: '2026-09-01', lines: [{ lineNo: 1, materialCode: 'EZ-ADS131M04', qty: '10', unitPrice: '12.00' }] }, '')).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' })
  })

  it('returns the original PO for an idempotent replay', async () => {
    const provider = makeProvider()
    const po = { supplierCode: 'SUP-DIGIKEY', currency: 'USD', orderDate: '2026-09-01', lines: [{ lineNo: 1, materialCode: 'EZ-ADS131M04', qty: '10', unitPrice: '12.00' }] }
    const first = await provider.createPurchaseOrder(po, 'tenant:PR-100:r1')
    const replay = await provider.createPurchaseOrder(po, 'tenant:PR-100:r1')
    expect(replay.externalId).toBe(first.externalId)
    expect(replay.idempotentReplay).toBe(true)
    expect(provider.getDataset().purchaseOrders.filter(item => item.idempotencyKey === 'tenant:PR-100:r1')).toHaveLength(1)
  })

  it('commits once during Network Drop After Commit and safely retries', async () => {
    const provider = makeProvider()
    provider.setScenario({ code: 'NETWORK_DROP_AFTER_COMMIT', enabled: true, latencyMs: 0, failureRate: 1 })
    const before = provider.getDataset().purchaseOrders.length
    const po = { supplierCode: 'SUP-LCSC', currency: 'CNY', orderDate: '2026-09-01', lines: [{ lineNo: 1, materialCode: 'EZ-SGM8301', qty: '100', unitPrice: '4.20' }] }
    await expect(provider.createPurchaseOrder(po, 'tenant:PR-101:r1')).rejects.toMatchObject({ code: 'NETWORK_DROP_AFTER_COMMIT', retryable: true })
    expect(provider.getDataset().purchaseOrders).toHaveLength(before + 1)
    const retry = await provider.createPurchaseOrder(po, 'tenant:PR-101:r1')
    expect(retry.idempotentReplay).toBe(true)
    expect(provider.getDataset().purchaseOrders).toHaveLength(before + 1)
    expect(provider.getDataset().requestLogs.some(log => log.result === 'COMMITTED_NO_RESPONSE')).toBe(true)
  })

  it('updates ETA and creates an audit record', async () => {
    const provider = makeProvider()
    const target = provider.getDataset().purchaseOrders[0]
    const result = await provider.updateEta({ poExternalId: target.externalId, lineNo: 1, eta: '2026-10-01', confirmedQty: '900' })
    expect(result.success).toBe(true)
    expect(provider.getDataset().purchaseOrders[0].lines[0].eta).toBe('2026-10-01')
    expect(provider.getDataset().auditLogs[0].action).toBe('UPDATE_ETA')
  })

  it('isolates datasets by tenant', () => {
    const a = new MemorySimulatorRepository('tenant-a')
    const b = new MemorySimulatorRepository('tenant-b')
    const changed = a.load(); changed.datasetName = 'A only'; a.save(changed)
    expect(a.load().datasetName).toBe('A only')
    expect(b.load().datasetName).not.toBe('A only')
  })
})
