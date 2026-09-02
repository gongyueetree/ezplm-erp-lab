import type { ErpProvider } from './contracts.js'
import { ErpProviderError } from './types.js'
import { KingdeeK3CloudProvider } from './kingdee/index.js'
import { KingdeeSimulatorProvider } from './simulator/index.js'
import type { SimulatorRepository } from './simulator/repository.js'

class NotConfiguredProvider implements ErpProvider {
  private fail = async (): Promise<never> => { throw new ErpProviderError('ERP_NOT_CONFIGURED', 'ERP Provider 尚未配置', false, 503) }
  testConnection = this.fail
  pullMaterials = this.fail
  pullInventory = this.fail
  pullExcess = this.fail
  pullSuppliers = this.fail
  pullCustomers = this.fail
  pullExchangeRates = this.fail
  pullOpenPurchaseOrders = this.fail
  createPurchaseOrder = this.fail
  updateEta = this.fail
}

export function getErpProvider(mode: string, repository?: SimulatorRepository): ErpProvider {
  if (mode === 'simulator') {
    if (!repository) throw new Error('Simulator repository is required')
    return new KingdeeSimulatorProvider(repository)
  }
  if (mode === 'kingdee') return new KingdeeK3CloudProvider()
  return new NotConfiguredProvider()
}
