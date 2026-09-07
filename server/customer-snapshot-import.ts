/**
 * 客户脱敏 ERP 快照导入(乾创 Excel 格式启发式)。
 *
 * closed-loop P0-3/P0-4 重构:
 * - 双模式:**STRICT_UAT(默认)** 任何静默纠偏都是错误 —— 非法数字/非法日期/
 *   断裂引用(物料/供应商/客户)逐行报错,**整批拒绝,一行不写**;
 *   DEMO_LENIENT 保留旧行为(0/今天兜底、REFERENCE_ONLY 补建)但逐项计入 warnings;
 * - 库存「货主名称」→ 客户主数据映射(按名称或编码)→ 写 customerCode;
 *   STRICT 下映射不到 = 断裂引用;**绝不把客户名称直接当 customerCode**;
 * - 报告:rowsRead / rowsAccepted / rowsRejected / warnings / brokenReferences /
 *   invalidDecimals / invalidDates —— 数字必须对得上账。
 */
import { randomUUID } from 'node:crypto'
import * as XLSX from 'xlsx'
import { prisma } from './prisma.js'

export type CustomerSnapshotType = 'MATERIAL' | 'INVENTORY' | 'EXCESS' | 'SUPPLIER' | 'CUSTOMER' | 'OPEN_PO' | 'FX'
export type ImportMode = 'STRICT_UAT' | 'DEMO_LENIENT'

export interface BrokenReference {
  type: 'Material' | 'Supplier' | 'Customer'
  value: string
  row: number
}

export interface CustomerSnapshotReport {
  type: CustomerSnapshotType
  mode: ImportMode
  rowsRead: number
  rowsAccepted: number
  rowsRejected: number
  warnings: string[]
  brokenReferences: BrokenReference[]
  invalidDecimals: { row: number; field: string; value: string }[]
  invalidDates: { row: number; field: string; value: string }[]
  inferredMaterials: number
  inferredSuppliers: number
}

type SourceRow = Record<string, unknown>

const text = (value: unknown) => String(value ?? '').trim()
const isDecimal = (v: string) => /^-?\d+(\.\d+)?$/.test(v)
const hashId = (prefix: string, values: unknown[]) => `${prefix}-${values.map(text).join('|').slice(0, 180)}`
const activeStatus = (reviewed: unknown, disabled: unknown) => text(disabled) === '是' ? 'DISABLED' : text(reviewed).includes('审核') ? 'ACTIVE' : text(reviewed) || 'ACTIVE'
const chunks = <T,>(rows: T[], size = 500) => Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size))

function parseRows(buffer: Buffer): SourceRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  return XLSX.utils.sheet_to_json<SourceRow>(workbook.Sheets[sheetName], { defval: null, raw: true })
}

/** 导入上下文:集中收集错误/警告,STRICT 下有错即整批拒绝 */
class ImportCtx {
  warnings: string[] = []
  brokenReferences: BrokenReference[] = []
  invalidDecimals: { row: number; field: string; value: string }[] = []
  invalidDates: { row: number; field: string; value: string }[] = []
  rejectedRows = new Set<number>()
  inferredMaterials = 0
  inferredSuppliers = 0

  constructor(readonly mode: ImportMode) {}

  /** 数字字段:STRICT 报错;LENIENT 记警告并回退 fallback */
  decimal(row: number, field: string, value: unknown, fallback = '0'): string {
    const normalized = text(value).replace(/,/g, '')
    if (normalized && isDecimal(normalized)) return normalized
    this.invalidDecimals.push({ row, field, value: text(value) || '(空)' })
    if (this.mode === 'STRICT_UAT') this.rejectedRows.add(row)
    else this.warnings.push(`第 ${row} 行「${field}」=「${text(value) || '空'}」非法,已按 ${fallback} 处理(DEMO_LENIENT)`)
    return fallback
  }

  /** 日期字段:STRICT 报错;LENIENT 回退今天 */
  dateOnly(row: number, field: string, value: unknown): string {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
    const raw = text(value)
    const parsed = raw ? new Date(raw.replace(/\//g, '-')) : null
    if (parsed && !Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
    this.invalidDates.push({ row, field, value: raw || '(空)' })
    if (this.mode === 'STRICT_UAT') this.rejectedRows.add(row)
    else this.warnings.push(`第 ${row} 行「${field}」=「${raw || '空'}」非法,已按今天处理(DEMO_LENIENT)`)
    return new Date().toISOString().slice(0, 10)
  }

  broken(row: number, type: BrokenReference['type'], value: string) {
    this.brokenReferences.push({ type, value, row })
    if (this.mode === 'STRICT_UAT') this.rejectedRows.add(row)
  }

  get hasErrors(): boolean {
    return this.mode === 'STRICT_UAT' && this.rejectedRows.size > 0
  }
}

async function ensureTenant(tenantId: string) {
  await prisma.erpSimTenant.upsert({
    where: { id: tenantId },
    create: { id: tenantId, datasetName: 'Customer reference snapshot', seededAt: new Date() },
    update: { datasetName: 'Customer reference snapshot' },
  })
}

async function knownMaterialCodes(tenantId: string, codes: string[]): Promise<Set<string>> {
  const rows = await prisma.erpSimMaterial.findMany({ where: { tenantId, materialCode: { in: codes } }, select: { materialCode: true } })
  return new Set(rows.map(r => r.materialCode))
}

/**
 * LENIENT 专用:补建 REFERENCE_ONLY 物料(旧行为)。
 * STRICT 下**绝不调用** —— 断裂引用是错误,不是补建的理由。
 */
async function createMissingMaterialsLenient(tenantId: string, rows: SourceRow[], ctx: ImportCtx, codeField = '物料编码') {
  const byCode = new Map<string, SourceRow>()
  for (const row of rows) {
    const code = text(row[codeField])
    if (code && !byCode.has(code)) byCode.set(code, row)
  }
  if (!byCode.size) return
  const existing = await knownMaterialCodes(tenantId, [...byCode.keys()])
  const missing = [...byCode.entries()].filter(([code]) => !existing.has(code)).map(([code, row]) => ({
    tenantId,
    externalId: `REFERENCE:${code}`,
    materialCode: code,
    manufacturer: text(row.MFG) || undefined,
    mpn: text(row.MFG_PN) || undefined,
    description: text(row['物料名称']) || text(row['描述']) || '交易数据引用的缺失物料',
    unit: text(row['库存主单位']) || text(row['采购单位']) || 'Pcs',
    lifecycle: 'REFERENCE_ONLY',
    status: 'INFERRED_FROM_TRANSACTION',
  }))
  for (const batch of chunks(missing)) await prisma.erpSimMaterial.createMany({ data: batch, skipDuplicates: true })
  ctx.inferredMaterials += missing.length
  if (missing.length) ctx.warnings.push(`自动补建 ${missing.length} 条 REFERENCE_ONLY 物料(DEMO_LENIENT)`)
}

/** STRICT 专用:校验物料引用,断裂逐行记错 */
async function checkMaterialRefs(tenantId: string, rows: SourceRow[], ctx: ImportCtx, codeField = '物料编码') {
  const codes = [...new Set(rows.map(r => text(r[codeField])).filter(Boolean))]
  const existing = await knownMaterialCodes(tenantId, codes)
  rows.forEach((row, index) => {
    const code = text(row[codeField])
    if (code && !existing.has(code)) ctx.broken(index + 2, 'Material', code)
  })
}

// ---- 各数据集 ----

async function importMaterials(tenantId: string, rows: SourceRow[], ctx: ImportCtx) {
  const data = rows.map(row => {
    const code = text(row['编码'])
    return {
      tenantId,
      externalId: code,
      materialCode: code,
      internalPn: code,
      description: text(row['名称']) || undefined,
      specification: text(row['规格型号']) || undefined,
      unit: text(row['基本单位']) || undefined,
      lifecycle: text(row['物料属性']) || undefined,
      status: activeStatus(row['数据状态'], row['禁用状态']),
      sourceUpdatedAt: null,
    }
  }).filter(row => row.externalId)
  if (ctx.hasErrors) return 0
  await prisma.$transaction([
    prisma.erpSimMaterial.deleteMany({ where: { tenantId } }),
    ...chunks(data).map(batch => prisma.erpSimMaterial.createMany({ data: batch, skipDuplicates: true })),
  ])
  return data.length
}

async function importSuppliers(tenantId: string, rows: SourceRow[], ctx: ImportCtx) {
  const data = rows.map(row => {
    const code = text(row['编码'])
    return { tenantId, externalId: code, supplierCode: code, name: text(row['名称']) || code, status: activeStatus(row['数据状态'], row['禁用状态']), currency: 'CNY', sourceUpdatedAt: null }
  }).filter(row => row.externalId)
  if (ctx.hasErrors) return 0
  await prisma.$transaction([prisma.erpSimSupplier.deleteMany({ where: { tenantId } }), ...chunks(data).map(batch => prisma.erpSimSupplier.createMany({ data: batch, skipDuplicates: true }))])
  return data.length
}

async function importCustomers(tenantId: string, rows: SourceRow[], ctx: ImportCtx) {
  const data = rows.map(row => {
    const code = text(row['客户编码'])
    return { tenantId, externalId: code, customerCode: code, name: text(row['客户名称']) || code, status: activeStatus(row['单据状态'], row['禁用状态']), sourceUpdatedAt: null }
  }).filter(row => row.externalId)
  if (ctx.hasErrors) return 0
  await prisma.$transaction([prisma.erpSimCustomer.deleteMany({ where: { tenantId } }), ...chunks(data).map(batch => prisma.erpSimCustomer.createMany({ data: batch, skipDuplicates: true }))])
  return data.length
}

/**
 * 库存:P0-4 —— 「货主名称」映射到客户主数据得出 customerCode。
 * 匹配顺序:客户名称精确 → 客户编码精确;都不中:STRICT 断裂引用,LENIENT 警告 + 留空。
 * **不把货主名称直接写进 customerCode**。空货主 = 公共库存,合法。
 */
async function importInventory(tenantId: string, rows: SourceRow[], ctx: ImportCtx) {
  if (ctx.mode === 'DEMO_LENIENT') await createMissingMaterialsLenient(tenantId, rows, ctx)
  else await checkMaterialRefs(tenantId, rows, ctx)

  const customers = await prisma.erpSimCustomer.findMany({ where: { tenantId }, select: { customerCode: true, name: true } })
  const byName = new Map(customers.map(c => [c.name.trim(), c.customerCode]))
  const byCode = new Map(customers.map(c => [c.customerCode.trim(), c.customerCode]))

  const data = rows.map((row, index) => {
    const rowNo = index + 2
    const materialCode = text(row['物料编码'])
    const warehouseName = text(row['仓库名称'])
    const lotNo = text(row['批号'])
    const owner = text(row['货主名称'])
    let customerCode: string | undefined
    if (owner) {
      customerCode = byName.get(owner) ?? byCode.get(owner)
      if (!customerCode) {
        ctx.broken(rowNo, 'Customer', owner)
        if (ctx.mode === 'DEMO_LENIENT') ctx.warnings.push(`第 ${rowNo} 行货主「${owner}」未匹配到客户主数据,customerCode 留空(DEMO_LENIENT)`)
      }
    }
    const qty = ctx.decimal(rowNo, '库存量(主单位)', row['库存量(主单位)'])
    return { tenantId, externalId: hashId('INV', [materialCode, warehouseName, lotNo, owner]), materialCode, warehouseCode: warehouseName || undefined, warehouseName: warehouseName || undefined, customerCode, onHandQty: qty, availableQty: qty, reservedQty: '0', lotNo: lotNo || undefined }
  }).filter(row => row.materialCode)
  if (ctx.hasErrors) return 0
  await prisma.$transaction([prisma.erpSimInventory.deleteMany({ where: { tenantId } }), ...chunks(data).map(batch => prisma.erpSimInventory.createMany({ data: batch, skipDuplicates: true }))])
  return data.length
}

async function importExcess(tenantId: string, rows: SourceRow[], ctx: ImportCtx) {
  if (ctx.mode === 'DEMO_LENIENT') await createMissingMaterialsLenient(tenantId, rows, ctx)
  else await checkMaterialRefs(tenantId, rows, ctx)

  const customers = await prisma.erpSimCustomer.findMany({ where: { tenantId }, select: { customerCode: true, name: true } })
  const byName = new Map(customers.map(c => [c.name.trim(), c.customerCode]))
  const byCode = new Map(customers.map(c => [c.customerCode.trim(), c.customerCode]))

  const data = rows.map((row, index) => {
    const rowNo = index + 2
    const materialCode = text(row['物料编码'])
    const rawCustomer = text(row['客户'])
    let customerCode: string | undefined
    if (rawCustomer) {
      customerCode = byCode.get(rawCustomer) ?? byName.get(rawCustomer)
      if (!customerCode) {
        ctx.broken(rowNo, 'Customer', rawCustomer)
        if (ctx.mode === 'DEMO_LENIENT') {
          ctx.warnings.push(`第 ${rowNo} 行客户「${rawCustomer}」未匹配到客户主数据,customerCode 留空(DEMO_LENIENT)`)
        }
      }
    }
    return {
      tenantId,
      externalId: hashId('EX', [rawCustomer, materialCode]),
      materialCode,
      customerCode,
      bookQty: ctx.decimal(rowNo, '即时库存', row['即时库存']),
      availableQty: ctx.decimal(rowNo, '呆滞数量(不含OPO)', row['呆滞数量（不含OPO）']),
      earliestInboundAt: row['最后业务发生时间'] ? new Date(ctx.dateOnly(rowNo, '最后业务发生时间', row['最后业务发生时间'])) : null,
      sourceDocumentId: text(row['涉及机种']) || undefined,
      sourceUpdatedAt: new Date(),
    }
  }).filter(row => row.materialCode)
  if (ctx.hasErrors) return 0
  await prisma.$transaction([prisma.erpSimExcess.deleteMany({ where: { tenantId } }), ...chunks(data).map(batch => prisma.erpSimExcess.createMany({ data: batch, skipDuplicates: true }))])
  return data.length
}

async function importPurchaseOrders(tenantId: string, rows: SourceRow[], ctx: ImportCtx) {
  if (ctx.mode === 'DEMO_LENIENT') await createMissingMaterialsLenient(tenantId, rows, ctx)
  else await checkMaterialRefs(tenantId, rows, ctx)

  const supplierRows = await prisma.erpSimSupplier.findMany({ where: { tenantId }, select: { supplierCode: true, name: true } })
  const supplierByName = new Map(supplierRows.map(row => [row.name.trim(), row.supplierCode]))
  const supplierByCode = new Map(supplierRows.map(row => [row.supplierCode.trim(), row.supplierCode]))
  const missingNames = new Set<string>()
  rows.forEach((row, index) => {
    const name = text(row['供应商'])
    if (name && !supplierByName.has(name) && !supplierByCode.has(name)) {
      missingNames.add(name)
      ctx.broken(index + 2, 'Supplier', name)
    }
  })
  if (ctx.mode === 'DEMO_LENIENT' && missingNames.size) {
    await prisma.erpSimSupplier.createMany({ data: [...missingNames].map(name => ({ tenantId, externalId: `REFERENCE:${name}`, supplierCode: name, name, status: 'REFERENCE_ONLY', currency: 'CNY' })), skipDuplicates: true })
    for (const name of missingNames) supplierByName.set(name, name)
    ctx.inferredSuppliers += missingNames.size
    ctx.warnings.push(`自动补建 ${missingNames.size} 条 REFERENCE_ONLY 供应商(DEMO_LENIENT)`)
  }

  const groups = new Map<string, { rows: SourceRow[]; rowNos: number[] }>()
  rows.forEach((row, index) => {
    const rawNumber = text(row['单据编号'])
    const poNumber = rawNumber.match(/^PO\d+/)?.[0] ?? rawNumber
    if (!poNumber) return
    const group = groups.get(poNumber) ?? { rows: [], rowNos: [] }
    group.rows.push(row); group.rowNos.push(index + 2); groups.set(poNumber, group)
  })

  // 先全量校验(数字/日期),再决定写不写
  for (const [, group] of groups) {
    group.rows.forEach((row, i) => {
      const rowNo = group.rowNos[i]
      ctx.decimal(rowNo, '采购数量', row['采购数量'])
      ctx.decimal(rowNo, '单价', row['单价'])
      ctx.dateOnly(rowNo, '采购日期', row['采购日期'])
      ctx.dateOnly(rowNo, '交货日期', row['交货日期'])
    })
  }
  if (ctx.hasErrors) return 0

  const lenientCtx = new ImportCtx('DEMO_LENIENT') // 写入阶段的取值复用宽松转换(已通过校验)
  await prisma.$transaction(async tx => {
    await tx.erpSimPurchaseOrder.deleteMany({ where: { tenantId } })
    for (const [poNumber, group] of groups) {
      const first = group.rows[0]
      const supplierName = text(first['供应商'])
      const closed = text(first['关闭状态']).includes('关闭') || text(first['业务关闭']).includes('关闭')
      await tx.erpSimPurchaseOrder.create({ data: {
        tenantId,
        externalId: poNumber,
        poNumber,
        supplierCode: supplierByCode.get(supplierName) ?? supplierByName.get(supplierName) ?? supplierName,
        currency: 'CNY',
        orderDate: new Date(lenientCtx.dateOnly(0, '采购日期', first['采购日期'])),
        requestedDate: new Date(lenientCtx.dateOnly(0, '交货日期', first['交货日期'])),
        status: closed ? 'CLOSED' : 'OPEN',
        lines: { create: group.rows.map((row, index) => ({ lineNo: index + 1, materialCode: text(row['物料编码']), qty: lenientCtx.decimal(0, '采购数量', row['采购数量']), unitPrice: lenientCtx.decimal(0, '单价', row['单价']), requestedDate: new Date(lenientCtx.dateOnly(0, '交货日期', row['交货日期'])), confirmedQty: lenientCtx.decimal(0, '累计收料数量', row['累计收料数量']) })) },
      } })
    }
  }, { timeout: 55_000 })
  return groups.size
}

/**
 * P1-9:FX 快照。**标准列名**(汇率结构简单,不做乾创格式启发式猜测):
 * 必填:基准币种 / 目标币种 / 汇率 / 生效日期;可选:类型。
 * 列名不符 → 逐行报错(不猜)。
 */
async function importFx(tenantId: string, rows: SourceRow[], ctx: ImportCtx) {
  const data = rows.map((row, index) => {
    const rowNo = index + 2
    const base = text(row['基准币种'])
    const quote = text(row['目标币种'])
    if (!base || !quote) {
      ctx.warnings.push(`第 ${rowNo} 行缺少 基准币种/目标币种 —— FX 快照要求标准列名(基准币种/目标币种/汇率/生效日期)`)
      if (ctx.mode === 'STRICT_UAT') ctx.rejectedRows.add(rowNo)
      return null
    }
    return {
      tenantId,
      baseCurrency: base.toUpperCase(),
      quoteCurrency: quote.toUpperCase(),
      rate: ctx.decimal(rowNo, '汇率', row['汇率'], '1'),
      rateType: text(row['类型']) || undefined,
      effectiveDate: new Date(ctx.dateOnly(rowNo, '生效日期', row['生效日期'])),
      source: 'CUSTOMER_SNAPSHOT',
    }
  }).filter((r): r is NonNullable<typeof r> => r !== null)
  if (ctx.hasErrors) return 0
  await prisma.$transaction([prisma.erpSimExchangeRate.deleteMany({ where: { tenantId } }), ...chunks(data).map(batch => prisma.erpSimExchangeRate.createMany({ data: batch, skipDuplicates: true }))])
  return data.length
}

export async function importCustomerSnapshot(tenantId: string, type: CustomerSnapshotType, buffer: Buffer, mode: ImportMode = 'STRICT_UAT'): Promise<CustomerSnapshotReport> {
  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(tenantId)) throw new Error('Invalid tenantId')
  const rows = parseRows(buffer)
  if (!rows.length) throw new Error('Excel 文件没有可导入的数据行')
  await ensureTenant(tenantId)

  const ctx = new ImportCtx(mode)
  const accepted = type === 'MATERIAL' ? await importMaterials(tenantId, rows, ctx)
    : type === 'SUPPLIER' ? await importSuppliers(tenantId, rows, ctx)
      : type === 'CUSTOMER' ? await importCustomers(tenantId, rows, ctx)
        : type === 'INVENTORY' ? await importInventory(tenantId, rows, ctx)
          : type === 'EXCESS' ? await importExcess(tenantId, rows, ctx)
            : type === 'FX' ? await importFx(tenantId, rows, ctx)
              : await importPurchaseOrders(tenantId, rows, ctx)

  const report: CustomerSnapshotReport = {
    type,
    mode,
    rowsRead: rows.length,
    rowsAccepted: ctx.hasErrors ? 0 : accepted,
    rowsRejected: ctx.hasErrors ? rows.length : 0,
    warnings: ctx.warnings,
    brokenReferences: ctx.brokenReferences,
    invalidDecimals: ctx.invalidDecimals,
    invalidDates: ctx.invalidDates,
    inferredMaterials: ctx.inferredMaterials,
    inferredSuppliers: ctx.inferredSuppliers,
  }
  await prisma.erpSimAuditLog.create({ data: { id: randomUUID(), tenantId, timestamp: new Date(), actor: 'erp-lab-user', action: ctx.hasErrors ? 'IMPORT_CUSTOMER_SNAPSHOT_REJECTED' : 'IMPORT_CUSTOMER_SNAPSHOT', entityType: type, result: ctx.hasErrors ? 'FAILED' : 'SUCCESS', details: JSON.stringify({ mode, rowsRead: rows.length, rowsAccepted: report.rowsAccepted, rowsRejected: report.rowsRejected, broken: ctx.brokenReferences.length, invalidDecimals: ctx.invalidDecimals.length, invalidDates: ctx.invalidDates.length }) } })
  if (ctx.hasErrors) {
    // STRICT:整批拒绝 —— 一行不写,报告如实带回(不是 throw:调用方要展示逐行明细)
    return report
  }
  return report
}
