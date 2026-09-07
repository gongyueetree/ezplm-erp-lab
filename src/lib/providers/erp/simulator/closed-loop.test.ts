import { describe, expect, it } from 'vitest'
import { KingdeeSimulatorProvider } from '.'
import { MemorySimulatorRepository } from './repository.js'
import { decodeCursor, encodeCursor } from './query.js'

const makeProvider = () => new KingdeeSimulatorProvider(new MemorySimulatorRepository('closed-loop-tenant'))

describe('closed-loop · 服务端过滤与分页(P0-5)', () => {
  it('pullInventory 按 customerCode 过滤在服务端完成 —— 未命中客户返回空页而不是全量', async () => {
    const provider = makeProvider()
    const all = await provider.pullInventory()
    expect(all.items.length).toBeGreaterThan(0)
    expect(all.hasMore).toBe(false)
    expect(all.total).toBe(all.items.length)

    const none = await provider.pullInventory({ customerCode: 'CUS-DOES-NOT-EXIST' })
    expect(none.items).toHaveLength(0)
    expect(none.total).toBe(0)
  })

  it('materialCode / warehouseCode 过滤生效;大小写不敏感', async () => {
    const provider = makeProvider()
    const byMaterial = await provider.pullInventory({ materialCode: 'ez-stm32h743' })
    expect(byMaterial.items).toHaveLength(1)
    expect(byMaterial.items[0].materialCode).toBe('EZ-STM32H743')

    const byWarehouse = await provider.pullInventory({ warehouseCode: 'SZ-RM' })
    expect(byWarehouse.total).toBe(6)
  })

  it('cursor 翻页:limit=2 逐页取完,页间无重复无遗漏;越界 cursor 归零', async () => {
    const provider = makeProvider()
    const seen: string[] = []
    let cursor: string | undefined
    for (let i = 0; i < 10; i++) {
      const page = await provider.pullInventory({ limit: 2, cursor })
      seen.push(...page.items.map(r => r.externalId))
      if (!page.hasMore) break
      cursor = page.cursor
    }
    expect(new Set(seen).size).toBe(6)
    // cursor 不透明:乱传按第一页处理,不炸
    const garbage = await provider.pullInventory({ limit: 2, cursor: '!!!not-a-cursor!!!' })
    expect(garbage.items).toHaveLength(2)
    expect(decodeCursor(encodeCursor(4))).toBe(4)
  })

  it('excess 按 customerCode 过滤:CUS-ACME 只见自己的两条', async () => {
    const provider = makeProvider()
    const acme = await provider.pullExcess({ customerCode: 'CUS-ACME' })
    expect(acme.items).toHaveLength(2)
    expect(acme.items.every(r => r.customerCode === 'CUS-ACME')).toBe(true)
  })
})

describe('closed-loop · 收货(P1-8)', () => {
  it('收货更新行 receivedQty、库存增加、PO 状态推进;幂等重放返回原收货单', async () => {
    const provider = makeProvider()
    const before = await provider.pullInventory({ materialCode: 'EZ-STM32H743' })
    const beforeQty = Number(before.items[0].onHandQty)

    const first = await provider.receivePurchaseOrder(
      { poExternalId: 'PO-EXT-001', lines: [{ lineNo: 1, qty: '400', lotNo: 'L-RCV-1', warehouseCode: 'SZ-RM' }] },
      'tenant:rcv-1',
    )
    expect(first.success).toBe(true)
    expect(first.documentNumber).toMatch(/^RCV/)

    const dataset = await provider.getDataset()
    const po = dataset.purchaseOrders.find(p => p.externalId === 'PO-EXT-001')!
    expect(po.lines[0].receivedQty).toBe('400')
    expect(po.status).toBe('PARTIALLY_RECEIVED') // 1000 中收了 400

    // 库存:新批次行(lotNo 不同)出现
    const after = await provider.pullInventory({ materialCode: 'EZ-STM32H743' })
    const totalAfter = after.items.reduce((n, r) => n + Number(r.onHandQty), 0)
    expect(totalAfter).toBe(beforeQty + 400)

    // 幂等重放:同 key 不重复入库
    const replay = await provider.receivePurchaseOrder(
      { poExternalId: 'PO-EXT-001', lines: [{ lineNo: 1, qty: '400' }] },
      'tenant:rcv-1',
    )
    expect(replay.idempotentReplay).toBe(true)
    expect(replay.externalId).toBe(first.externalId)
    const again = await provider.pullInventory({ materialCode: 'EZ-STM32H743' })
    expect(again.items.reduce((n, r) => n + Number(r.onHandQty), 0)).toBe(beforeQty + 400)
  })

  it('全部行收满 → PO CLOSED,并从 open PO 列表消失', async () => {
    const provider = makeProvider()
    await provider.receivePurchaseOrder(
      { poExternalId: 'PO-EXT-001', lines: [{ lineNo: 1, qty: '1000' }] },
      'tenant:rcv-full',
    )
    const dataset = await provider.getDataset()
    expect(dataset.purchaseOrders.find(p => p.externalId === 'PO-EXT-001')!.status).toBe('CLOSED')
    const open = await provider.pullOpenPurchaseOrders()
    expect(open.items.some(p => p.externalId === 'PO-EXT-001')).toBe(false)
  })

  it('缺幂等键 / PO 不存在 / 行不存在 / 非法数量 → 各自明确报错', async () => {
    const provider = makeProvider()
    await expect(provider.receivePurchaseOrder({ poExternalId: 'PO-EXT-001', lines: [{ lineNo: 1, qty: '1' }] }, '')).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REQUIRED' })
    await expect(provider.receivePurchaseOrder({ poExternalId: 'NOPE', lines: [{ lineNo: 1, qty: '1' }] }, 'k1')).rejects.toMatchObject({ code: 'PO_NOT_FOUND' })
    await expect(provider.receivePurchaseOrder({ poExternalId: 'PO-EXT-001', lines: [{ lineNo: 99, qty: '1' }] }, 'k2')).rejects.toMatchObject({ code: 'PO_LINE_NOT_FOUND' })
    await expect(provider.receivePurchaseOrder({ poExternalId: 'PO-EXT-001', lines: [{ lineNo: 1, qty: '-5' }] }, 'k3')).rejects.toMatchObject({ code: 'INVALID_DECIMAL' })
  })
})

describe('closed-loop · correlationId(P1-10)', () => {
  it('设置 correlationId 后,请求日志逐条携带', async () => {
    const provider = makeProvider()
    provider.correlationId = 'main-corr-123'
    await provider.pullInventory({ limit: 1 })
    const logs = (await provider.getDataset()).requestLogs
    expect(logs[0].correlationId).toBe('main-corr-123')
  })
})
