import type { VercelRequest, VercelResponse } from '@vercel/node'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ ok: true, service: 'ezplm-erp-lab', version: '2.0.0', databaseConfigured: Boolean(process.env.DATABASE_URL) })
}
