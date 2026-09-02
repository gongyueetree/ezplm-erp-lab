import { describe, expect, it } from 'vitest'
import { KingdeeSimulatorProvider } from '../../lib/providers/erp/simulator'
import { MemorySimulatorRepository } from '../../lib/providers/erp/simulator/repository'

describe('ERP-E2E · procurement flow', () => {
  it('pulls supply signals, creates a PO, then updates ETA', async () => {
    const provider = new KingdeeSimulatorProvider(new MemorySimulatorRepository('e2e-tenant'))
    const [inventory, excess, openPo] = await Promise.all([provider.pullInventory(), provider.pullExcess(), provider.pullOpenPurchaseOrders()])
    expect(inventory.length + excess.length + openPo.length).toBeGreaterThan(0)

    const created = await provider.createPurchaseOrder({
      supplierCode: 'SUP-DIGIKEY', currency: 'USD', orderDate: '2026-09-01', requestedDate: '2026-09-20',
      lines: [{ lineNo: 1, materialCode: 'EZ-ADS131M04', qty: '250', unitPrice: '13.85' }],
    }, 'e2e-tenant:PR-900:r2')
    expect(created.success).toBe(true)

    await provider.updateEta({ poExternalId: created.externalId, lineNo: 1, confirmedQty: '250', eta: '2026-09-18' })
    const saved = provider.getDataset().purchaseOrders.find(po => po.externalId === created.externalId)
    expect(saved?.lines[0].eta).toBe('2026-09-18')
    expect(provider.getDataset().auditLogs.map(log => log.action)).toEqual(expect.arrayContaining(['CREATE_PO', 'UPDATE_ETA']))
  })
})
