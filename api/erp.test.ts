import { afterEach, describe, expect, it } from 'vitest'
import handler from './erp.js'

describe('ERP API bootstrap', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = originalDatabaseUrl
  })

  it('P0-1:非公开租户(客户快照)匿名 GET → 401;未配令牌 → 503 fail-closed', async () => {
    process.env.DATABASE_URL = 'postgresql://placeholder/db'
    const originalToken = process.env.ERP_LAB_ACCESS_TOKEN

    // 令牌已配置:匿名 GET 客户租户 → 401(在触达 Prisma 之前就拒)
    process.env.ERP_LAB_ACCESS_TOKEN = 'test-token'
    let status = 0
    let body: unknown
    const response = {
      setHeader() {},
      status(value: number) { status = value; return this },
      json(value: unknown) { body = value; return this },
    }
    await handler({ query: { tenantId: 'primatronics-uat' }, body: {}, headers: {}, method: 'GET' } as any, response as any)
    expect(status).toBe(401)
    expect(body).toMatchObject({ ok: false, error: { code: 'ERP_LAB_UNAUTHORIZED' } })

    // 未配令牌:非公开租户直接 503(fail-closed),绝不放行
    delete process.env.ERP_LAB_ACCESS_TOKEN
    await handler({ query: { tenantId: 'primatronics-uat' }, body: {}, headers: {}, method: 'GET' } as any, response as any)
    expect(status).toBe(503)
    expect(body).toMatchObject({ ok: false, error: { code: 'ERP_LAB_ACCESS_TOKEN_NOT_CONFIGURED' } })

    if (originalToken === undefined) delete process.env.ERP_LAB_ACCESS_TOKEN
    else process.env.ERP_LAB_ACCESS_TOKEN = originalToken
    delete process.env.DATABASE_URL
  })

  it('returns a JSON configuration error before loading Prisma', async () => {
    delete process.env.DATABASE_URL
    let status = 0
    let body: unknown
    const response = {
      setHeader() {},
      status(value: number) { status = value; return this },
      json(value: unknown) { body = value; return this },
    }
    await handler({ query: {}, body: {}, headers: {}, method: 'GET' } as any, response as any)
    expect(status).toBe(503)
    expect(body).toMatchObject({ ok: false, error: { code: 'DATABASE_NOT_CONFIGURED' } })
  })
})
