import type { ErpProvider } from './contracts'
import { ErpProviderError, type DatasetType, type ErpEtaUpdate, type ErpPurchaseOrder, type ErpSimScenario, type PullOptions, type SimulatorDataset } from './types'

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error?: { code?: string; message?: string; retryable?: boolean } }

async function readApiResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  const text = await response.text()
  if (!text.trim()) throw new ErpProviderError('EMPTY_API_RESPONSE', `ERP API 返回空响应（HTTP ${response.status}）`, true, response.status)
  try {
    return JSON.parse(text) as ApiEnvelope<T>
  } catch {
    const code = response.status >= 500 ? 'SERVERLESS_FUNCTION_ERROR' : 'INVALID_API_RESPONSE'
    throw new ErpProviderError(code, `ERP 服务暂不可用（HTTP ${response.status}）。请检查 Vercel Function 日志和 PostgreSQL 环境变量。`, true, response.status)
  }
}

export class HttpErpLabProvider implements ErpProvider {
  constructor(private tenantId: string) {}

  setAccessToken(token: string) { sessionStorage.setItem('ezplm:erp-lab:access-token', token.trim()) }
  clearAccessToken() { sessionStorage.removeItem('ezplm:erp-lab:access-token') }
  hasAccessToken() { return Boolean(sessionStorage.getItem('ezplm:erp-lab:access-token')) }

  private async rpc<T>(operation: string, payload: Record<string, unknown> = {}): Promise<T> {
    const token = sessionStorage.getItem('ezplm:erp-lab:access-token')
    const response = await fetch('/api/erp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': this.tenantId, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ tenantId: this.tenantId, operation, payload }) })
    const result = await readApiResponse<T>(response)
    if (!response.ok || !result.ok) {
      const error = result.ok ? undefined : result.error
      throw new ErpProviderError(error?.code || 'HTTP_PROVIDER_ERROR', error?.message || 'ERP API request failed', Boolean(error?.retryable), response.status)
    }
    return result.data as T
  }

  async getDataset(): Promise<SimulatorDataset> {
    const response = await fetch(`/api/erp?tenantId=${encodeURIComponent(this.tenantId)}`, { cache: 'no-store' })
    const result = await readApiResponse<SimulatorDataset>(response)
    if (!response.ok || !result.ok) {
      const error = result.ok ? undefined : result.error
      throw new ErpProviderError(error?.code || 'DATABASE_NOT_CONFIGURED', error?.message || 'Cannot load ERP dataset', true, response.status)
    }
    return result.data
  }
  async getHealth(): Promise<{ ok: boolean; service: string; version: string; databaseConfigured: boolean }> {
    const response = await fetch('/api/health', { cache: 'no-store' })
    const text = await response.text()
    try { return JSON.parse(text) }
    catch { throw new ErpProviderError('HEALTH_CHECK_ERROR', `健康检查返回异常（HTTP ${response.status}）`, true, response.status) }
  }
  resetDataset = () => this.rpc<SimulatorDataset>('resetDataset')
  replaceDataset = (dataset: SimulatorDataset) => this.rpc<SimulatorDataset>('replaceDataset', { dataset })
  setScenario = (scenario: ErpSimScenario) => this.rpc<SimulatorDataset>('setScenario', { scenario })
  testConnection = () => this.rpc<any>('testConnection')
  pullMaterials = (input?: PullOptions) => this.rpc<any>('pullMaterials', { input })
  pullInventory = (input?: PullOptions) => this.rpc<any>('pullInventory', { input })
  pullExcess = (input?: PullOptions) => this.rpc<any>('pullExcess', { input })
  pullSuppliers = (input?: PullOptions) => this.rpc<any>('pullSuppliers', { input })
  pullCustomers = (input?: PullOptions) => this.rpc<any>('pullCustomers', { input })
  pullExchangeRates = (input?: PullOptions) => this.rpc<any>('pullExchangeRates', { input })
  pullOpenPurchaseOrders = (input?: PullOptions) => this.rpc<any>('pullOpenPurchaseOrders', { input })
  createPurchaseOrder = (input: ErpPurchaseOrder, idempotencyKey: string) => this.rpc<any>('createPurchaseOrder', { input, idempotencyKey })
  updateEta = (input: ErpEtaUpdate) => this.rpc<any>('updateEta', { input })
  upsertRecord = (type: Exclude<DatasetType, 'OPEN_PO'>, record: Record<string, unknown>, originalKey?: string) => this.rpc<SimulatorDataset>('upsertRecord', { type, record, originalKey })
  deleteRecord = (type: Exclude<DatasetType, 'OPEN_PO'>, key: string) => this.rpc<SimulatorDataset>('deleteRecord', { type, key })
}
