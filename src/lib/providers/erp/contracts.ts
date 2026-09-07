import type {
  ErpConnectionResult,
  ErpCustomer,
  ErpEtaUpdate,
  ErpExchangeRate,
  ErpExcess,
  ErpInventory,
  ErpMaterial,
  ErpPurchaseOrder,
  ErpSalesOrder,
  ErpSupplier,
  ErpWorkOrder,
  ErpWriteResult,
  PullOptions,
} from './types.js'

export interface ErpProvider {
  testConnection(): Promise<ErpConnectionResult>
  pullMaterials(input?: PullOptions): Promise<ErpMaterial[]>
  pullInventory(input?: PullOptions): Promise<ErpInventory[]>
  pullExcess(input?: PullOptions): Promise<ErpExcess[]>
  pullSuppliers(input?: PullOptions): Promise<ErpSupplier[]>
  pullCustomers(input?: PullOptions): Promise<ErpCustomer[]>
  pullExchangeRates(input?: PullOptions): Promise<ErpExchangeRate[]>
  pullOpenPurchaseOrders(input?: PullOptions): Promise<ErpPurchaseOrder[]>
  // LAB-1: 工单与销售订单（ECN 影响分析、缺料/齐料闭环）
  pullWorkOrders(input?: PullOptions): Promise<ErpWorkOrder[]>
  pullSalesOrders(input?: PullOptions): Promise<ErpSalesOrder[]>
  createPurchaseOrder(input: ErpPurchaseOrder, idempotencyKey: string): Promise<ErpWriteResult>
  updateEta(input: ErpEtaUpdate): Promise<ErpWriteResult>
}
