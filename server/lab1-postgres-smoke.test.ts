import { describe, expect, it } from 'vitest'

// 只在显式给了 SMOKE_DATABASE_URL 时跑:CI 无本地 Postgres,这不是常规门禁
const url = process.env.SMOKE_DATABASE_URL
describe.skipIf(!url)('LAB-1 · Postgres persistence smoke', () => {
  it('persists and reloads work orders and sales orders with nested lines', async () => {
    process.env.DATABASE_URL = url
    const { PrismaSimulatorRepository } = await import('./prisma-simulator-repository.js')
    const { KingdeeSimulatorProvider } = await import('../src/lib/providers/erp/simulator/index.js')
    const repo = new PrismaSimulatorRepository('smoke-tenant')
    const provider = new KingdeeSimulatorProvider(repo)
    const ds = await repo.load()
    expect(ds.workOrders.length).toBeGreaterThan(0)
    expect(ds.salesOrders.length).toBeGreaterThan(0)
    const wos = (await provider.pullWorkOrders()).items
    expect(wos[0].consumedLines.length).toBeGreaterThan(0)
    expect(typeof wos[0].qty).toBe('string')
    const again = await repo.load()
    expect(again.workOrders.every(wo => wo.consumedLines.length > 0)).toBe(true)
    expect(again.salesOrders.every(so => so.lines.length > 0)).toBe(true)
  }, 30_000)
})
