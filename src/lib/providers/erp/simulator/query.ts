/**
 * closed-loop: 数据集查询层。
 *
 * 目标:pull* 不再「整表加载后 slice」——
 * Prisma 仓储在 **DB where/skip/take** 层过滤分页(见 server/prisma-simulator-repository.ts);
 * Memory/Browser 仓储用本文件的内存实现(测试/演示数据量小,语义一致即可)。
 *
 * cursor 形态:`o:<offset>` 的 base64url,**不透明**——消费方不得解析,只能原样回传。
 */
import type {
  ErpCustomer,
  ErpExcess,
  ErpExchangeRate,
  ErpInventory,
  ErpInventoryLot,
  ErpInventoryMovement,
  ErpMaterial,
  ErpPurchaseOrder,
  ErpSalesOrder,
  ErpSupplier,
  ErpWorkOrder,
  PullOptions,
} from '../types.js'

export interface PageQuery {
  customerCode?: string
  materialCode?: string
  warehouseCode?: string
  updatedSince?: string
  offset: number
  limit: number
}

export interface PagedRows<T> {
  items: T[]
  total: number
}

export const DEFAULT_PAGE_LIMIT = 200
export const MAX_PAGE_LIMIT = 1000

// 不用 Buffer(浏览器 tsconfig 无 node 类型);cursor 本就只需不透明,简单混淆即可
export function encodeCursor(offset: number): string {
  return `o${offset.toString(36)}`
}

export function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0
  const m = /^o([0-9a-z]+)$/.exec(cursor)
  const n = m ? parseInt(m[1], 36) : 0
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/** PullOptions → PageQuery(limit 夹取,cursor 解码) */
export function toPageQuery(input: PullOptions = {}): PageQuery {
  return {
    customerCode: input.customerCode?.trim() || undefined,
    materialCode: input.materialCode?.trim() || undefined,
    warehouseCode: input.warehouseCode?.trim() || undefined,
    updatedSince: input.updatedSince,
    offset: decodeCursor(input.cursor),
    limit: Math.min(MAX_PAGE_LIMIT, Math.max(1, input.limit ?? DEFAULT_PAGE_LIMIT)),
  }
}

export function pageEnvelope<T>(paged: PagedRows<T>, q: PageQuery) {
  const nextOffset = q.offset + paged.items.length
  const hasMore = nextOffset < paged.total
  return {
    items: paged.items,
    cursor: hasMore ? encodeCursor(nextOffset) : undefined,
    hasMore,
    total: paged.total,
  }
}

// ---- 内存实现(Memory/Browser 仓储共用) ----

const eq = (a: string | undefined, b: string | undefined) =>
  (a ?? '').trim().toUpperCase() === (b ?? '').trim().toUpperCase()

function slicePage<T>(rows: T[], q: PageQuery): PagedRows<T> {
  return { items: rows.slice(q.offset, q.offset + q.limit), total: rows.length }
}

export function memQueryMaterials(rows: ErpMaterial[], q: PageQuery): PagedRows<ErpMaterial> {
  let out = rows
  if (q.materialCode) out = out.filter(r => eq(r.materialCode, q.materialCode))
  if (q.updatedSince) out = out.filter(r => !r.updatedAt || r.updatedAt >= q.updatedSince!)
  return slicePage(out, q)
}

export function memQueryInventory(rows: ErpInventory[], q: PageQuery): PagedRows<ErpInventory> {
  let out = rows
  if (q.customerCode) out = out.filter(r => eq(r.customerCode, q.customerCode))
  if (q.materialCode) out = out.filter(r => eq(r.materialCode, q.materialCode))
  if (q.warehouseCode) out = out.filter(r => eq(r.warehouseCode, q.warehouseCode))
  return slicePage(out, q)
}

export function memQueryExcess(rows: ErpExcess[], q: PageQuery): PagedRows<ErpExcess> {
  let out = rows
  if (q.customerCode) out = out.filter(r => eq(r.customerCode, q.customerCode))
  if (q.materialCode) out = out.filter(r => eq(r.materialCode, q.materialCode))
  if (q.warehouseCode) out = out.filter(r => eq(r.warehouseCode, q.warehouseCode))
  return slicePage(out, q)
}

export function memQuerySuppliers(rows: ErpSupplier[], q: PageQuery): PagedRows<ErpSupplier> {
  return slicePage(rows, q)
}

export function memQueryCustomers(rows: ErpCustomer[], q: PageQuery): PagedRows<ErpCustomer> {
  const out = q.customerCode ? rows.filter(r => eq(r.customerCode, q.customerCode)) : rows
  return slicePage(out, q)
}

export function memQueryFx(rows: ErpExchangeRate[], q: PageQuery): PagedRows<ErpExchangeRate> {
  return slicePage(rows, q)
}

export function memQueryOpenPos(rows: ErpPurchaseOrder[], q: PageQuery): PagedRows<ErpPurchaseOrder> {
  let out = rows.filter(po => po.status !== 'CLOSED')
  if (q.materialCode) out = out.filter(po => po.lines.some(l => eq(l.materialCode, q.materialCode)))
  return slicePage(out, q)
}

export function memQueryWorkOrders(rows: ErpWorkOrder[], q: PageQuery): PagedRows<ErpWorkOrder> {
  let out = rows
  if (q.customerCode) out = out.filter(r => eq(r.customerCode, q.customerCode))
  if (q.materialCode) out = out.filter(r => r.consumedLines.some(l => eq(l.materialCode, q.materialCode)))
  return slicePage(out, q)
}

export function memQuerySalesOrders(rows: ErpSalesOrder[], q: PageQuery): PagedRows<ErpSalesOrder> {
  const out = q.customerCode ? rows.filter(r => eq(r.customerCode, q.customerCode)) : rows
  return slicePage(out, q)
}

export function memQueryMovements(rows: ErpInventoryMovement[], q: PageQuery): PagedRows<ErpInventoryMovement> {
  let out = rows
  if (q.customerCode) out = out.filter(r => eq(r.customerCode, q.customerCode))
  if (q.materialCode) out = out.filter(r => eq(r.materialCode, q.materialCode))
  if (q.warehouseCode) out = out.filter(r => eq(r.warehouseCode, q.warehouseCode))
  if (q.updatedSince) out = out.filter(r => r.occurredAt >= q.updatedSince!)
  return slicePage(out, q)
}

export function memQueryLots(rows: ErpInventoryLot[], q: PageQuery): PagedRows<ErpInventoryLot> {
  let out = rows
  if (q.customerCode) out = out.filter(r => eq(r.customerCode, q.customerCode))
  if (q.materialCode) out = out.filter(r => eq(r.materialCode, q.materialCode))
  if (q.warehouseCode) out = out.filter(r => eq(r.warehouseCode, q.warehouseCode))
  return slicePage(out, q)
}
