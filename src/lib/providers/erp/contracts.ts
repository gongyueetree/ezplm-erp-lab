import type {
  ErpConnectionResult,
  ErpCustomer,
  ErpEtaUpdate,
  ErpExchangeRate,
  ErpExcess,
  ErpInventory,
  ErpMaterial,
  ErpPurchaseOrder,
  ErpSupplier,
  ErpWriteResult,
  PullOptions,
} from './types'

export interface ErpProvider {
  testConnection(): Promise<ErpConnectionResult>
  pullMaterials(input?: PullOptions): Promise<ErpMaterial[]>
  pullInventory(input?: PullOptions): Promise<ErpInventory[]>
  pullExcess(input?: PullOptions): Promise<ErpExcess[]>
  pullSuppliers(input?: PullOptions): Promise<ErpSupplier[]>
  pullCustomers(input?: PullOptions): Promise<ErpCustomer[]>
  pullExchangeRates(input?: PullOptions): Promise<ErpExchangeRate[]>
  pullOpenPurchaseOrders(input?: PullOptions): Promise<ErpPurchaseOrder[]>
  createPurchaseOrder(input: ErpPurchaseOrder, idempotencyKey: string): Promise<ErpWriteResult>
  updateEta(input: ErpEtaUpdate): Promise<ErpWriteResult>
}
