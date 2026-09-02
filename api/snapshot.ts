import { timingSafeEqual } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { CustomerSnapshotType } from '../server/customer-snapshot-import.js'

export const config = { api: { bodyParser: false }, maxDuration: 60 }

const allowedTypes = new Set<CustomerSnapshotType>(['MATERIAL', 'INVENTORY', 'EXCESS', 'SUPPLIER', 'CUSTOMER', 'OPEN_PO'])
const safeMessage = (error: unknown) => (error instanceof Error ? error.message : 'Unknown import error').replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[DATABASE_URL]').slice(0, 500)

const authorized = (req: VercelRequest) => {
  const expected = process.env.ERP_LAB_ACCESS_TOKEN
  const actual = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  if (!expected || expected.length !== actual.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
}

async function readBody(req: VercelRequest) {
  const parts: Buffer[] = []
  let size = 0
  for await (const part of req) {
    const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part)
    size += chunk.length
    if (size > 3 * 1024 * 1024) throw new Error('文件超过 3 MB 导入上限')
    parts.push(chunk)
  }
  return Buffer.concat(parts)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST' } })
    if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, error: { code: 'DATABASE_NOT_CONFIGURED', message: 'DATABASE_URL is not configured.' } })
    if (!authorized(req)) return res.status(401).json({ ok: false, error: { code: 'ERP_LAB_UNAUTHORIZED', message: '需要有效的 ERP Lab 管理凭证' } })
    const type = String(req.query.type ?? '') as CustomerSnapshotType
    if (!allowedTypes.has(type)) return res.status(400).json({ ok: false, error: { code: 'INVALID_SNAPSHOT_TYPE', message: '无法识别该快照类型' } })
    const tenantId = String(req.query.tenantId ?? 'ezplm-demo')
    const body = await readBody(req)
    const { importCustomerSnapshot } = await import('../server/customer-snapshot-import.js')
    return res.status(200).json({ ok: true, data: await importCustomerSnapshot(tenantId, type, body) })
  } catch (error) {
    return res.status(500).json({ ok: false, error: { code: 'SNAPSHOT_IMPORT_ERROR', message: safeMessage(error), retryable: false } })
  }
}
