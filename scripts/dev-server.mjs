/**
 * closed-loop: 本地 HTTP 服务 —— 主仓(ezplm-smt-scm)的 ERP 闭环验收测试用靶。
 *
 * 复用**真实的** api/erp.ts / api/snapshot.ts / api/health.ts handler(Vercel 签名加薄壳),
 * 走 PrismaSimulatorRepository + 本地 Postgres —— 与线上行为同源,不是另一套模拟。
 *
 * 用法:
 *   DATABASE_URL=postgresql://.../erp_lab_dev ERP_LAB_ACCESS_TOKEN=dev-token \
 *     node --import tsx scripts/dev-server.mjs [port]
 */
import http from 'node:http'
import { parse } from 'node:url'

const port = Number(process.argv[2] ?? process.env.PORT ?? 4870)
if (!process.env.DATABASE_URL) {
  console.error('[dev-server] 需要 DATABASE_URL(本地 Postgres)')
  process.exit(1)
}
if (!process.env.ERP_LAB_ACCESS_TOKEN) {
  console.error('[dev-server] 需要 ERP_LAB_ACCESS_TOKEN(闭环测试要走真实鉴权路径)')
  process.exit(1)
}

const { default: erpHandler } = await import('../api/erp.ts')
const { default: healthHandler } = await import('../api/health.ts')
const { default: snapshotHandler } = await import('../api/snapshot.ts')

function shim(req, res, body) {
  const { pathname, query } = parse(req.url ?? '/', true)
  const vreq = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query,
    body: body.length ? safeJson(body) : {},
    [Symbol.asyncIterator]: async function* () { yield body },
  }
  const vres = {
    setHeader: (k, v) => res.setHeader(k, v),
    status(code) { res.statusCode = code; return this },
    json(value) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); return this },
  }
  return { pathname, vreq, vres }
}

function safeJson(buffer) {
  try { return JSON.parse(buffer.toString('utf-8')) } catch { return {} }
}

const server = http.createServer((req, res) => {
  const parts = []
  req.on('data', c => parts.push(c))
  req.on('end', async () => {
    const body = Buffer.concat(parts)
    const { pathname, vreq, vres } = shim(req, res, body)
    try {
      if (pathname === '/api/erp') await erpHandler(vreq, vres)
      else if (pathname === '/api/health') await healthHandler(vreq, vres)
      else if (pathname === '/api/snapshot') await snapshotHandler(vreq, vres)
      else { res.statusCode = 404; res.end(JSON.stringify({ ok: false, error: { code: 'NOT_FOUND' } })) }
    } catch (error) {
      res.statusCode = 500
      res.end(JSON.stringify({ ok: false, error: { code: 'DEV_SERVER_ERROR', message: String(error?.message ?? error) } }))
    }
  })
})

server.listen(port, () => {
  console.log(`[dev-server] ERP Lab listening on http://127.0.0.1:${port} (Prisma + 真实 handler)`)
})
