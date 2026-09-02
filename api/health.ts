import type { VercelRequest, VercelResponse } from '@vercel/node'

const safeMessage = (error: unknown) => (error instanceof Error ? error.message : 'Unknown database error')
  .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[DATABASE_URL]')
  .slice(0, 500)

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (!process.env.DATABASE_URL) return res.status(503).json({ ok: false, service: 'ezplm-erp-lab', version: '2.1.0', databaseConfigured: false, databaseReachable: false, error: { code: 'DATABASE_NOT_CONFIGURED', message: 'DATABASE_URL is not configured.' } })
  const started = Date.now()
  try {
    const { prisma } = await import('../server/prisma.js')
    await prisma.$queryRaw`SELECT 1`
    return res.status(200).json({ ok: true, service: 'ezplm-erp-lab', version: '2.1.0', databaseConfigured: true, databaseReachable: true, latencyMs: Date.now() - started })
  } catch (error) {
    return res.status(503).json({ ok: false, service: 'ezplm-erp-lab', version: '2.1.0', databaseConfigured: true, databaseReachable: false, error: { code: 'DATABASE_UNREACHABLE', message: safeMessage(error) } })
  }
}
