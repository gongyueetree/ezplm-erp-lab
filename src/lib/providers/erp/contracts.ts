import type {
  ErpConnectionResult,
  ErpCustomer,
  ErpEtaUpdate,
  ErpExchangeRate,
  ErpExcess,
  ErpInventory,
  ErpInventoryLot,
  ErpInventoryMovement,
  ErpMaterial,
  ErpPullPage,
  ErpPurchaseOrder,
  ErpReceiveInput,
  ErpSalesOrder,
  ErpSupplier,
  ErpWorkOrder,
  ErpWriteResult,
  PullOptions,
} from './types.js'

/**
 * closed-loop 契约升级(与主仓 ezplm-smt-scm 的镜像同步):
 * - pull* 统一返回分页信封 ErpPullPage(不再是裸数组)——
 *   服务端按 customerCode/materialCode/warehouseCode 过滤 + cursor 翻页,
 *   数据最小化:门户/影响分析按需取数,不整库拉取;
 * - 新增 receivePurchaseOrder:PO → 收货 → 库存增加 → PO 状态推进的最小闭环。
 */
export interface ErpProvider {
  testConnection(): Promise<ErpConnectionResult>
  pullMaterials(input?: PullOptions): Promise<ErpPullPage<ErpMaterial>>
  pullInventory(input?: PullOptions): Promise<ErpPullPage<ErpInventory>>
  pullExcess(input?: PullOptions): Promise<ErpPullPage<ErpExcess>>
  pullSuppliers(input?: PullOptions): Promise<ErpPullPage<ErpSupplier>>
  pullCustomers(input?: PullOptions): Promise<ErpPullPage<ErpCustomer>>
  pullExchangeRates(input?: PullOptions): Promise<ErpPullPage<ErpExchangeRate>>
  pullOpenPurchaseOrders(input?: PullOptions): Promise<ErpPullPage<ErpPurchaseOrder>>
  pullWorkOrders(input?: PullOptions): Promise<ErpPullPage<ErpWorkOrder>>
  pullSalesOrders(input?: PullOptions): Promise<ErpPullPage<ErpSalesOrder>>
  /** R3-7:库存异动/批次(门户 Transactions/Lots 数据源) */
  pullInventoryMovements(input?: PullOptions): Promise<ErpPullPage<ErpInventoryMovement>>
  pullInventoryLots(input?: PullOptions): Promise<ErpPullPage<ErpInventoryLot>>
  createPurchaseOrder(input: ErpPurchaseOrder, idempotencyKey: string): Promise<ErpWriteResult>
  updateEta(input: ErpEtaUpdate): Promise<ErpWriteResult>
  receivePurchaseOrder(input: ErpReceiveInput, idempotencyKey: string): Promise<ErpWriteResult>
}
