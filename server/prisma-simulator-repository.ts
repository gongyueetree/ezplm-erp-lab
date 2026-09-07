import { Prisma, type PrismaClient } from '@prisma/client'
import type { SimulatorRepository } from '../src/lib/providers/erp/simulator/repository.js'
import { createSeedDataset } from '../src/lib/providers/erp/simulator/seed.js'
import type { ErpRequestLog, ErpSimScenario, ErpWorkOrder, ScenarioCode, SimulatorDataset } from '../src/lib/providers/erp/types.js'
import type { PagedRows, PageQuery } from '../src/lib/providers/erp/simulator/query.js'
import { prisma } from './prisma.js'

const iso = (value: Date | null | undefined) => value?.toISOString()
const date = (value?: string) => value ? new Date(value) : null
const json = (value: unknown) => value === undefined ? Prisma.JsonNull : value as Prisma.InputJsonValue

export class PrismaSimulatorRepository implements SimulatorRepository {
  constructor(public readonly tenantId: string, private readonly db: PrismaClient = prisma) {
    if (!/^[a-zA-Z0-9_-]{2,64}$/.test(tenantId)) throw new Error('Invalid tenantId')
  }

  async load(): Promise<SimulatorDataset> {
    let tenant = await this.readTenant()
    if (!tenant) {
      await this.save(createSeedDataset(this.tenantId))
      tenant = await this.readTenant()
    }
    if (!tenant) throw new Error('Failed to initialize ERP simulator tenant')

    return {
      version: 2,
      tenantId: tenant.id,
      datasetName: tenant.datasetName,
      seededAt: tenant.seededAt.toISOString(),
      materials: tenant.materials.map(row => ({ externalId: row.externalId, materialCode: row.materialCode, internalPn: row.internalPn ?? undefined, manufacturer: row.manufacturer ?? undefined, mpn: row.mpn ?? undefined, description: row.description ?? undefined, specification: row.specification ?? undefined, unit: row.unit ?? undefined, lifecycle: row.lifecycle ?? undefined, status: row.status ?? undefined, updatedAt: iso(row.sourceUpdatedAt) })),
      inventory: tenant.inventory.map(row => ({ externalId: row.externalId, materialCode: row.materialCode, warehouseCode: row.warehouseCode ?? undefined, warehouseName: row.warehouseName ?? undefined, customerCode: row.customerCode ?? undefined, onHandQty: row.onHandQty.toString(), availableQty: row.availableQty?.toString(), reservedQty: row.reservedQty?.toString(), lotNo: row.lotNo ?? undefined, updatedAt: iso(row.sourceUpdatedAt) })),
      excess: tenant.excess.map(row => ({ externalId: row.externalId, materialCode: row.materialCode, customerCode: row.customerCode ?? undefined, warehouseCode: row.warehouseCode ?? undefined, bookQty: row.bookQty.toString(), availableQty: row.availableQty.toString(), earliestInboundAt: iso(row.earliestInboundAt)?.slice(0, 10), sourceDocumentId: row.sourceDocumentId ?? undefined, sourceUpdatedAt: iso(row.sourceUpdatedAt) })),
      suppliers: tenant.suppliers.map(row => ({ externalId: row.externalId, supplierCode: row.supplierCode, name: row.name, status: row.status ?? undefined, currency: row.currency ?? undefined, updatedAt: iso(row.sourceUpdatedAt) })),
      customers: tenant.customers.map(row => ({ externalId: row.externalId, customerCode: row.customerCode, name: row.name, status: row.status ?? undefined, updatedAt: iso(row.sourceUpdatedAt) })),
      exchangeRates: tenant.exchangeRates.map(row => ({ baseCurrency: row.baseCurrency, quoteCurrency: row.quoteCurrency, rate: row.rate.toString(), rateType: row.rateType ?? undefined, effectiveDate: row.effectiveDate.toISOString().slice(0, 10), source: row.source })),
      purchaseOrders: tenant.purchaseOrders.map(po => ({ externalId: po.externalId ?? undefined, poNumber: po.poNumber ?? undefined, supplierCode: po.supplierCode, currency: po.currency, orderDate: po.orderDate.toISOString().slice(0, 10), requestedDate: iso(po.requestedDate)?.slice(0, 10), status: po.status as 'OPEN' | 'PARTIALLY_RECEIVED' | 'CLOSED' | undefined, idempotencyKey: po.idempotencyKey ?? undefined, lines: po.lines.map(line => ({ lineNo: line.lineNo, materialCode: line.materialCode, qty: line.qty.toString(), unitPrice: line.unitPrice.toString(), requestedDate: iso(line.requestedDate)?.slice(0, 10), confirmedQty: line.confirmedQty?.toString(), receivedQty: line.receivedQty?.toString(), eta: iso(line.eta)?.slice(0, 10), shipDate: iso(line.shipDate)?.slice(0, 10) })) })),
      receipts: tenant.receipts.map(r => ({ externalId: r.externalId, receiptNumber: r.receiptNumber, poExternalId: r.poExternalId, poNumber: r.poNumber ?? undefined, receivedAt: r.receivedAt.toISOString(), idempotencyKey: r.idempotencyKey ?? undefined, lines: r.lines.map(line => ({ lineNo: line.lineNo, materialCode: line.materialCode, qty: line.qty.toString(), lotNo: line.lotNo ?? undefined, warehouseCode: line.warehouseCode ?? undefined })) })),
      workOrders: tenant.workOrders.map(wo => ({ externalId: wo.externalId, woNumber: wo.woNumber, customerCode: wo.customerCode ?? undefined, productCode: wo.productCode, bomRef: wo.bomRef ?? undefined, qty: wo.qty.toString(), status: wo.status as ErpWorkOrder['status'], currentOperation: wo.currentOperation ?? undefined, consumedLines: wo.consumedLines.map(line => ({ materialCode: line.materialCode, consumedQty: line.consumedQty.toString() })), plannedStart: iso(wo.plannedStart)?.slice(0, 10), plannedEnd: iso(wo.plannedEnd)?.slice(0, 10) })),
      salesOrders: tenant.salesOrders.map(so => ({ externalId: so.externalId, soNumber: so.soNumber, customerCode: so.customerCode, status: so.status ?? undefined, lines: so.lines.map(line => ({ lineNo: line.lineNo, productCode: line.productCode, qty: line.qty.toString(), shippedQty: line.shippedQty?.toString(), requestedDate: iso(line.requestedDate)?.slice(0, 10) })) })),
      scenario: tenant.scenario ? { code: tenant.scenario.code as ScenarioCode, enabled: tenant.scenario.enabled, latencyMs: tenant.scenario.latencyMs, failureRate: tenant.scenario.failureRate, targetOperation: tenant.scenario.targetOperation ?? undefined } : { code: 'NORMAL', enabled: true, latencyMs: 120, failureRate: 0 },
      requestLogs: tenant.requestLogs.map(row => ({ id: row.id, tenantId: row.tenantId, timestamp: row.timestamp.toISOString(), operation: row.operation, requestId: row.requestId, correlationId: row.correlationId ?? undefined, attempt: row.attempt, requestPayload: row.requestPayload, responsePayload: row.responsePayload, latency: row.latency, scenario: row.scenario as ScenarioCode, result: row.result as 'SUCCESS' | 'FAILED' | 'COMMITTED_NO_RESPONSE', errorCode: row.errorCode ?? undefined, errorMessage: row.errorMessage ?? undefined })),
      auditLogs: tenant.auditLogs.map(row => ({ id: row.id, tenantId: row.tenantId, timestamp: row.timestamp.toISOString(), actor: row.actor, action: row.action, entityType: row.entityType, entityId: row.entityId ?? undefined, result: row.result as 'SUCCESS' | 'FAILED', details: row.details ?? undefined })),
      mappingProfiles: tenant.mappingProfiles.map(row => ({ id: row.id, name: row.name, datasetType: row.datasetType as any, mappings: row.mappings as any, createdAt: row.createdAt.toISOString() })),
    }
  }

  async save(dataset: SimulatorDataset): Promise<void> {
    if (dataset.tenantId !== this.tenantId) throw new Error('Tenant isolation violation')
    await this.db.$transaction(async tx => {
      await tx.erpSimTenant.upsert({ where: { id: this.tenantId }, create: { id: this.tenantId, datasetName: dataset.datasetName, seededAt: new Date(dataset.seededAt) }, update: { datasetName: dataset.datasetName, seededAt: new Date(dataset.seededAt) } })
      await Promise.all([
        tx.erpSimMaterial.deleteMany({ where: { tenantId: this.tenantId } }), tx.erpSimInventory.deleteMany({ where: { tenantId: this.tenantId } }),
        tx.erpSimExcess.deleteMany({ where: { tenantId: this.tenantId } }), tx.erpSimSupplier.deleteMany({ where: { tenantId: this.tenantId } }),
        tx.erpSimCustomer.deleteMany({ where: { tenantId: this.tenantId } }), tx.erpSimExchangeRate.deleteMany({ where: { tenantId: this.tenantId } }),
        tx.erpSimPurchaseOrder.deleteMany({ where: { tenantId: this.tenantId } }), tx.erpSimRequestLog.deleteMany({ where: { tenantId: this.tenantId } }),
        tx.erpSimWorkOrder.deleteMany({ where: { tenantId: this.tenantId } }), tx.erpSimSalesOrder.deleteMany({ where: { tenantId: this.tenantId } }),
        tx.erpSimReceipt.deleteMany({ where: { tenantId: this.tenantId } }),
        tx.erpSimAuditLog.deleteMany({ where: { tenantId: this.tenantId } }), tx.erpSimMappingProfile.deleteMany({ where: { tenantId: this.tenantId } }),
      ])
      await tx.erpSimScenario.upsert({ where: { tenantId: this.tenantId }, create: { tenantId: this.tenantId, ...dataset.scenario }, update: dataset.scenario })
      if (dataset.materials.length) await tx.erpSimMaterial.createMany({ data: dataset.materials.map(row => ({ tenantId: this.tenantId, externalId: row.externalId, materialCode: row.materialCode, internalPn: row.internalPn, manufacturer: row.manufacturer, mpn: row.mpn, description: row.description, specification: row.specification, unit: row.unit, lifecycle: row.lifecycle, status: row.status, sourceUpdatedAt: date(row.updatedAt) })) })
      if (dataset.inventory.length) await tx.erpSimInventory.createMany({ data: dataset.inventory.map(row => ({ tenantId: this.tenantId, externalId: row.externalId, materialCode: row.materialCode, warehouseCode: row.warehouseCode, warehouseName: row.warehouseName, customerCode: row.customerCode, onHandQty: row.onHandQty, availableQty: row.availableQty, reservedQty: row.reservedQty, lotNo: row.lotNo, sourceUpdatedAt: date(row.updatedAt) })) })
      if (dataset.excess.length) await tx.erpSimExcess.createMany({ data: dataset.excess.map(row => ({ tenantId: this.tenantId, externalId: row.externalId, materialCode: row.materialCode, customerCode: row.customerCode, warehouseCode: row.warehouseCode, bookQty: row.bookQty, availableQty: row.availableQty, earliestInboundAt: date(row.earliestInboundAt), sourceDocumentId: row.sourceDocumentId, sourceUpdatedAt: date(row.sourceUpdatedAt) })) })
      if (dataset.suppliers.length) await tx.erpSimSupplier.createMany({ data: dataset.suppliers.map(row => ({ tenantId: this.tenantId, externalId: row.externalId, supplierCode: row.supplierCode, name: row.name, status: row.status, currency: row.currency, sourceUpdatedAt: date(row.updatedAt) })) })
      if (dataset.customers.length) await tx.erpSimCustomer.createMany({ data: dataset.customers.map(row => ({ tenantId: this.tenantId, externalId: row.externalId, customerCode: row.customerCode, name: row.name, status: row.status, sourceUpdatedAt: date(row.updatedAt) })) })
      if (dataset.exchangeRates.length) await tx.erpSimExchangeRate.createMany({ data: dataset.exchangeRates.map(row => ({ tenantId: this.tenantId, baseCurrency: row.baseCurrency, quoteCurrency: row.quoteCurrency, rate: row.rate, rateType: row.rateType, effectiveDate: new Date(row.effectiveDate), source: row.source })) })
      for (const po of dataset.purchaseOrders) await tx.erpSimPurchaseOrder.create({ data: { tenantId: this.tenantId, externalId: po.externalId, poNumber: po.poNumber, supplierCode: po.supplierCode, currency: po.currency, orderDate: new Date(po.orderDate), requestedDate: date(po.requestedDate), status: po.status, idempotencyKey: po.idempotencyKey, lines: { create: po.lines.map(line => ({ lineNo: line.lineNo, materialCode: line.materialCode, qty: line.qty, unitPrice: line.unitPrice, requestedDate: date(line.requestedDate), confirmedQty: line.confirmedQty, receivedQty: line.receivedQty, eta: date(line.eta), shipDate: date(line.shipDate) })) } } })
      // LAB-1: 兼容旧数据集快照（replaceDataset 传入无 workOrders/salesOrders 的 v1 数据不炸）
      for (const wo of dataset.workOrders ?? []) await tx.erpSimWorkOrder.create({ data: { tenantId: this.tenantId, externalId: wo.externalId, woNumber: wo.woNumber, customerCode: wo.customerCode, productCode: wo.productCode, bomRef: wo.bomRef, qty: wo.qty, status: wo.status, currentOperation: wo.currentOperation, plannedStart: date(wo.plannedStart), plannedEnd: date(wo.plannedEnd), consumedLines: { create: (wo.consumedLines ?? []).map(line => ({ materialCode: line.materialCode, consumedQty: line.consumedQty })) } } })
      for (const so of dataset.salesOrders ?? []) await tx.erpSimSalesOrder.create({ data: { tenantId: this.tenantId, externalId: so.externalId, soNumber: so.soNumber, customerCode: so.customerCode, status: so.status, lines: { create: (so.lines ?? []).map(line => ({ lineNo: line.lineNo, productCode: line.productCode, qty: line.qty, shippedQty: line.shippedQty, requestedDate: date(line.requestedDate) })) } } })
      for (const r of dataset.receipts ?? []) await tx.erpSimReceipt.create({ data: { tenantId: this.tenantId, externalId: r.externalId, receiptNumber: r.receiptNumber, poExternalId: r.poExternalId, poNumber: r.poNumber, receivedAt: new Date(r.receivedAt), idempotencyKey: r.idempotencyKey, lines: { create: r.lines.map(line => ({ lineNo: line.lineNo, materialCode: line.materialCode, qty: line.qty, lotNo: line.lotNo, warehouseCode: line.warehouseCode })) } } })
      if (dataset.requestLogs.length) await tx.erpSimRequestLog.createMany({ data: dataset.requestLogs.map(row => ({ id: row.id, tenantId: this.tenantId, timestamp: new Date(row.timestamp), operation: row.operation, requestId: row.requestId, correlationId: row.correlationId ?? undefined, attempt: row.attempt, requestPayload: json(row.requestPayload), responsePayload: json(row.responsePayload), latency: row.latency, scenario: row.scenario, result: row.result, errorCode: row.errorCode, errorMessage: row.errorMessage })) })
      if (dataset.auditLogs.length) await tx.erpSimAuditLog.createMany({ data: dataset.auditLogs.map(row => ({ id: row.id, tenantId: this.tenantId, timestamp: new Date(row.timestamp), actor: row.actor, action: row.action, entityType: row.entityType, entityId: row.entityId, result: row.result, details: row.details })) })
      if (dataset.mappingProfiles.length) await tx.erpSimMappingProfile.createMany({ data: dataset.mappingProfiles.map(row => ({ id: row.id, tenantId: this.tenantId, name: row.name, datasetType: row.datasetType, mappings: row.mappings as Prisma.InputJsonValue, createdAt: new Date(row.createdAt) })) })
    })
  }

  async reset(): Promise<SimulatorDataset> {
    const dataset = createSeedDataset(this.tenantId)
    await this.save(dataset)
    return dataset
  }

  // ---- closed-loop: DB 级过滤分页(不整库加载)与轻量场景/日志 ----

  async getScenario(): Promise<ErpSimScenario> {
    const row = await this.db.erpSimScenario.findUnique({ where: { tenantId: this.tenantId } })
    if (!row) {
      await this.load() // 未播种则触发播种
      return this.getScenario()
    }
    return { code: row.code as ScenarioCode, enabled: row.enabled, latencyMs: row.latencyMs, failureRate: row.failureRate, targetOperation: row.targetOperation ?? undefined }
  }

  async appendRequestLog(entry: ErpRequestLog): Promise<void> {
    await this.db.erpSimRequestLog.create({ data: { id: entry.id, tenantId: this.tenantId, timestamp: new Date(entry.timestamp), operation: entry.operation, requestId: entry.requestId, correlationId: entry.correlationId, attempt: entry.attempt, requestPayload: json(entry.requestPayload), responsePayload: json(entry.responsePayload), latency: entry.latency, scenario: entry.scenario, result: entry.result, errorCode: entry.errorCode, errorMessage: entry.errorMessage } })
  }

  private page(q: PageQuery) { return { skip: q.offset, take: q.limit } }

  async queryMaterials(q: PageQuery): Promise<PagedRows<import('../src/lib/providers/erp/types.js').ErpMaterial>> {
    const where = { tenantId: this.tenantId, ...(q.materialCode ? { materialCode: { equals: q.materialCode, mode: 'insensitive' as const } } : {}), ...(q.updatedSince ? { sourceUpdatedAt: { gte: new Date(q.updatedSince) } } : {}) }
    const [rows, total] = await Promise.all([this.db.erpSimMaterial.findMany({ where, orderBy: { materialCode: 'asc' }, ...this.page(q) }), this.db.erpSimMaterial.count({ where })])
    return { items: rows.map(row => ({ externalId: row.externalId, materialCode: row.materialCode, internalPn: row.internalPn ?? undefined, manufacturer: row.manufacturer ?? undefined, mpn: row.mpn ?? undefined, description: row.description ?? undefined, specification: row.specification ?? undefined, unit: row.unit ?? undefined, lifecycle: row.lifecycle ?? undefined, status: row.status ?? undefined, updatedAt: iso(row.sourceUpdatedAt) })), total }
  }

  async queryInventory(q: PageQuery): Promise<PagedRows<import('../src/lib/providers/erp/types.js').ErpInventory>> {
    const where = {
      tenantId: this.tenantId,
      ...(q.customerCode ? { customerCode: { equals: q.customerCode, mode: 'insensitive' as const } } : {}),
      ...(q.materialCode ? { materialCode: { equals: q.materialCode, mode: 'insensitive' as const } } : {}),
      ...(q.warehouseCode ? { warehouseCode: { equals: q.warehouseCode, mode: 'insensitive' as const } } : {}),
    }
    const [rows, total] = await Promise.all([this.db.erpSimInventory.findMany({ where, orderBy: { materialCode: 'asc' }, ...this.page(q) }), this.db.erpSimInventory.count({ where })])
    return { items: rows.map(row => ({ externalId: row.externalId, materialCode: row.materialCode, warehouseCode: row.warehouseCode ?? undefined, warehouseName: row.warehouseName ?? undefined, customerCode: row.customerCode ?? undefined, onHandQty: row.onHandQty.toString(), availableQty: row.availableQty?.toString(), reservedQty: row.reservedQty?.toString(), lotNo: row.lotNo ?? undefined, updatedAt: iso(row.sourceUpdatedAt) })), total }
  }

  async queryExcess(q: PageQuery): Promise<PagedRows<import('../src/lib/providers/erp/types.js').ErpExcess>> {
    const where = {
      tenantId: this.tenantId,
      ...(q.customerCode ? { customerCode: { equals: q.customerCode, mode: 'insensitive' as const } } : {}),
      ...(q.materialCode ? { materialCode: { equals: q.materialCode, mode: 'insensitive' as const } } : {}),
      ...(q.warehouseCode ? { warehouseCode: { equals: q.warehouseCode, mode: 'insensitive' as const } } : {}),
    }
    const [rows, total] = await Promise.all([this.db.erpSimExcess.findMany({ where, orderBy: { materialCode: 'asc' }, ...this.page(q) }), this.db.erpSimExcess.count({ where })])
    return { items: rows.map(row => ({ externalId: row.externalId, materialCode: row.materialCode, customerCode: row.customerCode ?? undefined, warehouseCode: row.warehouseCode ?? undefined, bookQty: row.bookQty.toString(), availableQty: row.availableQty.toString(), earliestInboundAt: iso(row.earliestInboundAt)?.slice(0, 10), sourceDocumentId: row.sourceDocumentId ?? undefined, sourceUpdatedAt: iso(row.sourceUpdatedAt) })), total }
  }

  async querySuppliers(q: PageQuery): Promise<PagedRows<import('../src/lib/providers/erp/types.js').ErpSupplier>> {
    const where = { tenantId: this.tenantId }
    const [rows, total] = await Promise.all([this.db.erpSimSupplier.findMany({ where, orderBy: { supplierCode: 'asc' }, ...this.page(q) }), this.db.erpSimSupplier.count({ where })])
    return { items: rows.map(row => ({ externalId: row.externalId, supplierCode: row.supplierCode, name: row.name, status: row.status ?? undefined, currency: row.currency ?? undefined, updatedAt: iso(row.sourceUpdatedAt) })), total }
  }

  async queryCustomers(q: PageQuery): Promise<PagedRows<import('../src/lib/providers/erp/types.js').ErpCustomer>> {
    const where = { tenantId: this.tenantId, ...(q.customerCode ? { customerCode: { equals: q.customerCode, mode: 'insensitive' as const } } : {}) }
    const [rows, total] = await Promise.all([this.db.erpSimCustomer.findMany({ where, orderBy: { customerCode: 'asc' }, ...this.page(q) }), this.db.erpSimCustomer.count({ where })])
    return { items: rows.map(row => ({ externalId: row.externalId, customerCode: row.customerCode, name: row.name, status: row.status ?? undefined, updatedAt: iso(row.sourceUpdatedAt) })), total }
  }

  async queryExchangeRates(q: PageQuery): Promise<PagedRows<import('../src/lib/providers/erp/types.js').ErpExchangeRate>> {
    const where = { tenantId: this.tenantId }
    const [rows, total] = await Promise.all([this.db.erpSimExchangeRate.findMany({ where, orderBy: { effectiveDate: 'desc' }, ...this.page(q) }), this.db.erpSimExchangeRate.count({ where })])
    return { items: rows.map(row => ({ baseCurrency: row.baseCurrency, quoteCurrency: row.quoteCurrency, rate: row.rate.toString(), rateType: row.rateType ?? undefined, effectiveDate: row.effectiveDate.toISOString().slice(0, 10), source: row.source })), total }
  }

  async queryOpenPurchaseOrders(q: PageQuery): Promise<PagedRows<import('../src/lib/providers/erp/types.js').ErpPurchaseOrder>> {
    const where = {
      tenantId: this.tenantId,
      NOT: { status: 'CLOSED' },
      ...(q.materialCode ? { lines: { some: { materialCode: { equals: q.materialCode, mode: 'insensitive' as const } } } } : {}),
    }
    const [rows, total] = await Promise.all([
      this.db.erpSimPurchaseOrder.findMany({ where, include: { lines: { orderBy: { lineNo: 'asc' } } }, orderBy: { orderDate: 'asc' }, ...this.page(q) }),
      this.db.erpSimPurchaseOrder.count({ where }),
    ])
    return { items: rows.map(po => ({ externalId: po.externalId ?? undefined, poNumber: po.poNumber ?? undefined, supplierCode: po.supplierCode, currency: po.currency, orderDate: po.orderDate.toISOString().slice(0, 10), requestedDate: iso(po.requestedDate)?.slice(0, 10), status: po.status as 'OPEN' | 'PARTIALLY_RECEIVED' | 'CLOSED' | undefined, idempotencyKey: po.idempotencyKey ?? undefined, lines: po.lines.map(line => ({ lineNo: line.lineNo, materialCode: line.materialCode, qty: line.qty.toString(), unitPrice: line.unitPrice.toString(), requestedDate: iso(line.requestedDate)?.slice(0, 10), confirmedQty: line.confirmedQty?.toString(), receivedQty: line.receivedQty?.toString(), eta: iso(line.eta)?.slice(0, 10), shipDate: iso(line.shipDate)?.slice(0, 10) })) })), total }
  }

  async queryWorkOrders(q: PageQuery): Promise<PagedRows<ErpWorkOrder>> {
    const where = {
      tenantId: this.tenantId,
      ...(q.customerCode ? { customerCode: { equals: q.customerCode, mode: 'insensitive' as const } } : {}),
      ...(q.materialCode ? { consumedLines: { some: { materialCode: { equals: q.materialCode, mode: 'insensitive' as const } } } } : {}),
    }
    const [rows, total] = await Promise.all([
      this.db.erpSimWorkOrder.findMany({ where, include: { consumedLines: true }, orderBy: { woNumber: 'asc' }, ...this.page(q) }),
      this.db.erpSimWorkOrder.count({ where }),
    ])
    return { items: rows.map(wo => ({ externalId: wo.externalId, woNumber: wo.woNumber, customerCode: wo.customerCode ?? undefined, productCode: wo.productCode, bomRef: wo.bomRef ?? undefined, qty: wo.qty.toString(), status: wo.status as ErpWorkOrder['status'], currentOperation: wo.currentOperation ?? undefined, consumedLines: wo.consumedLines.map(line => ({ materialCode: line.materialCode, consumedQty: line.consumedQty.toString() })), plannedStart: iso(wo.plannedStart)?.slice(0, 10), plannedEnd: iso(wo.plannedEnd)?.slice(0, 10) })), total }
  }

  async querySalesOrders(q: PageQuery): Promise<PagedRows<import('../src/lib/providers/erp/types.js').ErpSalesOrder>> {
    const where = { tenantId: this.tenantId, ...(q.customerCode ? { customerCode: { equals: q.customerCode, mode: 'insensitive' as const } } : {}) }
    const [rows, total] = await Promise.all([
      this.db.erpSimSalesOrder.findMany({ where, include: { lines: { orderBy: { lineNo: 'asc' } } }, orderBy: { soNumber: 'asc' }, ...this.page(q) }),
      this.db.erpSimSalesOrder.count({ where }),
    ])
    return { items: rows.map(so => ({ externalId: so.externalId, soNumber: so.soNumber, customerCode: so.customerCode, status: so.status ?? undefined, lines: so.lines.map(line => ({ lineNo: line.lineNo, productCode: line.productCode, qty: line.qty.toString(), shippedQty: line.shippedQty?.toString(), requestedDate: iso(line.requestedDate)?.slice(0, 10) })) })), total }
  }

  private readTenant() {
    return this.db.erpSimTenant.findUnique({ where: { id: this.tenantId }, include: { materials: true, inventory: true, excess: true, suppliers: true, customers: true, exchangeRates: true, purchaseOrders: { include: { lines: { orderBy: { lineNo: 'asc' } } }, orderBy: { orderDate: 'asc' } }, workOrders: { include: { consumedLines: true }, orderBy: { woNumber: 'asc' } }, receipts: { include: { lines: { orderBy: { lineNo: 'asc' } } }, orderBy: { receivedAt: 'asc' } }, salesOrders: { include: { lines: { orderBy: { lineNo: 'asc' } } }, orderBy: { soNumber: 'asc' } }, scenario: true, requestLogs: { orderBy: { timestamp: 'desc' }, take: 250 }, auditLogs: { orderBy: { timestamp: 'desc' }, take: 250 }, mappingProfiles: true } })
  }
}
