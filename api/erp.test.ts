import { afterEach, describe, expect, it } from 'vitest'
import handler from './erp.js'

describe('ERP API bootstrap', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = originalDatabaseUrl
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
