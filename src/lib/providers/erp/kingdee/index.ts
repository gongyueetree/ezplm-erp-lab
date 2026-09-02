import type { ErpProvider } from '../contracts'
import { ErpProviderError } from '../types'

const notReady = (): never => {
  throw new ErpProviderError('WAITING_FOR_DOCUMENTATION', '尚未提供金蝶 K3 云星空接口文档、认证方式与字段映射；真实 Provider 未启用。', false, 501)
}

export class KingdeeK3CloudProvider implements ErpProvider {
  testConnection = async () => notReady()
  pullMaterials = async () => notReady()
  pullInventory = async () => notReady()
  pullExcess = async () => notReady()
  pullSuppliers = async () => notReady()
  pullCustomers = async () => notReady()
  pullExchangeRates = async () => notReady()
  pullOpenPurchaseOrders = async () => notReady()
  createPurchaseOrder = async () => notReady()
  updateEta = async () => notReady()
}
