import type { VercelRequest, VercelResponse } from '@vercel/node'
import { KingdeeSimulatorProvider } from '../src/lib/providers/erp/simulator'
import { ErpProviderError, type ErpPurchaseOrder, type ErpSimScenario, type SimulatorDataset } from '../src/lib/providers/erp/types'

const tenantFrom = (req: VercelRequest) => String(req.query.tenantId || req.body?.tenantId || req.headers['x-tenant-id'] || 'ezplm-demo')

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (!process.env.DATABASE_URL) throw new ErpProviderError('DATABASE_NOT_CONFIGURED', '服务端尚未配置 DATABASE_URL，请先连接 PostgreSQL 并执行 Prisma migration。', false, 503)
    const tenantId = tenantFrom(req)
    if (req.method === 'POST' && process.env.NODE_ENV === 'production') {
      const configuredToken = process.env.ERP_LAB_ACCESS_TOKEN
      if (!configuredToken) throw new ErpProviderError('ERP_LAB_ACCESS_TOKEN_NOT_CONFIGURED', '服务端尚未配置 ERP_LAB_ACCESS_TOKEN', false, 503)
      if (req.headers.authorization !== `Bearer ${configuredToken}`) throw new ErpProviderError('ERP_LAB_UNAUTHORIZED', '需要有效的 ERP Lab 管理凭证', false, 401)
    }
    const { PrismaSimulatorRepository } = await import('../server/prisma-simulator-repository')
    const provider = new KingdeeSimulatorProvider(new PrismaSimulatorRepository(tenantId))
    if (req.method === 'GET') return res.status(200).json({ ok: true, data: await provider.getDataset() })
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET or POST' } })

    const { operation, payload = {} } = req.body ?? {}
    let data: unknown
    switch (operation) {
      case 'resetDataset': data = await provider.resetDataset(); break
      case 'replaceDataset': await provider.replaceDataset(payload.dataset as SimulatorDataset); data = await provider.getDataset(); break
      case 'setScenario': await provider.setScenario(payload.scenario as ErpSimScenario); data = await provider.getDataset(); break
      case 'testConnection': data = await provider.testConnection(); break
      case 'pullMaterials': data = await provider.pullMaterials(payload.input); break
      case 'pullInventory': data = await provider.pullInventory(payload.input); break
      case 'pullExcess': data = await provider.pullExcess(payload.input); break
      case 'pullSuppliers': data = await provider.pullSuppliers(payload.input); break
      case 'pullCustomers': data = await provider.pullCustomers(payload.input); break
      case 'pullExchangeRates': data = await provider.pullExchangeRates(payload.input); break
      case 'pullOpenPurchaseOrders': data = await provider.pullOpenPurchaseOrders(payload.input); break
      case 'createPurchaseOrder': data = await provider.createPurchaseOrder(payload.input as ErpPurchaseOrder, String(payload.idempotencyKey || '')); break
      case 'updateEta': data = await provider.updateEta(payload.input); break
      default: throw new ErpProviderError('UNKNOWN_OPERATION', `Unknown ERP operation: ${operation}`, false, 400)
    }
    return res.status(200).json({ ok: true, data })
  } catch (error) {
    const normalized = error instanceof ErpProviderError ? error : new ErpProviderError('DATABASE_OR_SERVER_ERROR', error instanceof Error ? error.message : 'Unknown server error', true, 500)
    return res.status(normalized.httpStatus).json({ ok: false, error: { code: normalized.code, message: normalized.message, retryable: normalized.retryable } })
  }
}
