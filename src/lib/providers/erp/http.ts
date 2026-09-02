import type { ErpProvider } from './contracts'
import { ErpProviderError, type ErpEtaUpdate, type ErpPurchaseOrder, type ErpSimScenario, type PullOptions, type SimulatorDataset } from './types'

export class HttpErpLabProvider implements ErpProvider {
  constructor(private tenantId: string) {}

  setAccessToken(token: string) { sessionStorage.setItem('ezplm:erp-lab:access-token', token.trim()) }
  clearAccessToken() { sessionStorage.removeItem('ezplm:erp-lab:access-token') }
  hasAccessToken() { return Boolean(sessionStorage.getItem('ezplm:erp-lab:access-token')) }

  private async rpc<T>(operation: string, payload: Record<string, unknown> = {}): Promise<T> {
    const token = sessionStorage.getItem('ezplm:erp-lab:access-token')
    const response = await fetch('/api/erp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': this.tenantId, ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ tenantId: this.tenantId, operation, payload }) })
    const result = await response.json()
    if (!response.ok || !result.ok) throw new ErpProviderError(result.error?.code || 'HTTP_PROVIDER_ERROR', result.error?.message || 'ERP API request failed', Boolean(result.error?.retryable), response.status)
    return result.data as T
  }

  async getDataset(): Promise<SimulatorDataset> {
    const response = await fetch(`/api/erp?tenantId=${encodeURIComponent(this.tenantId)}`, { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok || !result.ok) throw new ErpProviderError(result.error?.code || 'DATABASE_NOT_CONFIGURED', result.error?.message || 'Cannot load ERP dataset', true, response.status)
    return result.data
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
}
