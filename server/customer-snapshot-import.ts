import { createHash, randomUUID } from 'node:crypto'
import * as XLSX from 'xlsx'
import { prisma } from './prisma.js'

export type CustomerSnapshotType = 'MATERIAL' | 'INVENTORY' | 'EXCESS' | 'SUPPLIER' | 'CUSTOMER' | 'OPEN_PO'

export type CustomerSnapshotReport = {
  type: CustomerSnapshotType
  rowsRead: number
  recordsImported: number
  inferredMaterials: number
  inferredSuppliers: number
  warnings: string[]
}

type SourceRow = Record<string, unknown>

const text = (value: unknown) => String(value ?? '').trim()
const decimal = (value: unknown, fallback = '0') => {
  const normalized = text(value).replace(/,/g, '')
  return /^-?\d+(\.\d+)?$/.test(normalized) ? normalized : fallback
}
const isoDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  const raw = text(value)
  if (!raw) return undefined
  const parsed = new Date(raw.replace(/\//g, '-'))
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}
const dateOnly = (value: unknown, fallback = new Date().toISOString().slice(0, 10)) => isoDate(value)?.slice(0, 10) ?? fallback
const hashId = (prefix: string, values: unknown[]) => `${prefix}-${createHash('sha256').update(values.map(text).join('|')).digest('hex').slice(0, 24)}`
const activeStatus = (reviewed: unknown, disabled: unknown) => text(disabled) === '是' ? 'DISABLED' : text(reviewed).includes('审核') ? 'ACTIVE' : text(reviewed) || 'ACTIVE'
const chunks = <T,>(rows: T[], size = 500) => Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size))

function parseRows(buffer: Buffer): SourceRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  return XLSX.utils.sheet_to_json<SourceRow>(workbook.Sheets[sheetName], { defval: null, raw: true })
}

async function ensureTenant(tenantId: string) {
  await prisma.erpSimTenant.upsert({
    where: { id: tenantId },
    create: { id: tenantId, datasetName: 'Customer reference snapshot', seededAt: new Date() },
    update: { datasetName: 'Customer reference snapshot' },
  })
}

async function createMissingMaterials(tenantId: string, rows: SourceRow[], codeField = '物料编码') {
  const byCode = new Map<string, SourceRow>()
  for (const row of rows) {
    const code = text(row[codeField])
    if (code && !byCode.has(code)) byCode.set(code, row)
  }
  if (!byCode.size) return 0
  const existing = new Set((await prisma.erpSimMaterial.findMany({ where: { tenantId, materialCode: { in: [...byCode.keys()] } }, select: { materialCode: true } })).map(row => row.materialCode))
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
  return missing.length
}

async function importMaterials(tenantId: string, rows: SourceRow[]) {
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
      sourceUpdatedAt: isoDate(row['创建日期']) ? new Date(isoDate(row['创建日期'])!) : null,
    }
  }).filter(row => row.externalId)
  await prisma.$transaction([
    prisma.erpSimMaterial.deleteMany({ where: { tenantId } }),
    ...chunks(data).map(batch => prisma.erpSimMaterial.createMany({ data: batch, skipDuplicates: true })),
  ])
  return { recordsImported: data.length, inferredMaterials: 0, inferredSuppliers: 0, warnings: [] }
}

async function importSuppliers(tenantId: string, rows: SourceRow[]) {
  const data = rows.map(row => {
    const code = text(row['编码'])
    return { tenantId, externalId: code, supplierCode: code, name: text(row['名称']) || code, status: activeStatus(row['数据状态'], row['禁用状态']), currency: 'CNY', sourceUpdatedAt: isoDate(row['审核日期']) ? new Date(isoDate(row['审核日期'])!) : null }
  }).filter(row => row.externalId)
  await prisma.$transaction([prisma.erpSimSupplier.deleteMany({ where: { tenantId } }), ...chunks(data).map(batch => prisma.erpSimSupplier.createMany({ data: batch, skipDuplicates: true }))])
  return { recordsImported: data.length, inferredMaterials: 0, inferredSuppliers: 0, warnings: [] }
}

async function importCustomers(tenantId: string, rows: SourceRow[]) {
  const data = rows.map(row => {
    const code = text(row['客户编码'])
    return { tenantId, externalId: code, customerCode: code, name: text(row['客户名称']) || code, status: activeStatus(row['单据状态'], row['禁用状态']), sourceUpdatedAt: isoDate(row['审核日期']) ? new Date(isoDate(row['审核日期'])!) : null }
  }).filter(row => row.externalId)
  await prisma.$transaction([prisma.erpSimCustomer.deleteMany({ where: { tenantId } }), ...chunks(data).map(batch => prisma.erpSimCustomer.createMany({ data: batch, skipDuplicates: true }))])
  return { recordsImported: data.length, inferredMaterials: 0, inferredSuppliers: 0, warnings: [] }
}

async function importInventory(tenantId: string, rows: SourceRow[]) {
  const inferredMaterials = await createMissingMaterials(tenantId, rows)
  const data = rows.map(row => {
    const materialCode = text(row['物料编码'])
    const warehouseName = text(row['仓库名称'])
    const lotNo = text(row['批号'])
    const owner = text(row['货主名称'])
    const qty = decimal(row['库存量(主单位)'])
    return { tenantId, externalId: hashId('INV', [materialCode, warehouseName, lotNo, owner]), materialCode, warehouseCode: warehouseName || undefined, warehouseName: warehouseName || undefined, onHandQty: qty, availableQty: qty, reservedQty: '0', lotNo: lotNo || undefined }
  }).filter(row => row.materialCode)
  await prisma.$transaction([prisma.erpSimInventory.deleteMany({ where: { tenantId } }), ...chunks(data).map(batch => prisma.erpSimInventory.createMany({ data: batch, skipDuplicates: true }))])
  return { recordsImported: data.length, inferredMaterials, inferredSuppliers: 0, warnings: inferredMaterials ? [`从库存引用自动补建 ${inferredMaterials} 条 REFERENCE_ONLY 物料`] : [] }
}

async function importExcess(tenantId: string, rows: SourceRow[]) {
  const inferredMaterials = await createMissingMaterials(tenantId, rows)
  const data = rows.map(row => {
    const materialCode = text(row['物料编码'])
    const customerCode = text(row['客户'])
    return {
      tenantId,
      externalId: hashId('EX', [customerCode, materialCode]),
      materialCode,
      customerCode: customerCode || undefined,
      bookQty: decimal(row['即时库存']),
      availableQty: decimal(row['呆滞数量（不含OPO）']),
      earliestInboundAt: isoDate(row['最后业务发生时间']) ? new Date(isoDate(row['最后业务发生时间'])!) : null,
      sourceDocumentId: text(row['涉及机种']) || undefined,
      sourceUpdatedAt: new Date(),
    }
  }).filter(row => row.materialCode)
  await prisma.$transaction([prisma.erpSimExcess.deleteMany({ where: { tenantId } }), ...chunks(data).map(batch => prisma.erpSimExcess.createMany({ data: batch, skipDuplicates: true }))])
  return { recordsImported: data.length, inferredMaterials, inferredSuppliers: 0, warnings: inferredMaterials ? [`从 Excess 引用自动补建 ${inferredMaterials} 条 REFERENCE_ONLY 物料`] : [] }
}

async function importPurchaseOrders(tenantId: string, rows: SourceRow[]) {
  const inferredMaterials = await createMissingMaterials(tenantId, rows)
  const supplierRows = await prisma.erpSimSupplier.findMany({ where: { tenantId }, select: { supplierCode: true, name: true } })
  const supplierByName = new Map(supplierRows.map(row => [row.name.trim(), row.supplierCode]))
  const missingNames = [...new Set(rows.map(row => text(row['供应商'])).filter(name => name && !supplierByName.has(name)))]
  if (missingNames.length) {
    await prisma.erpSimSupplier.createMany({ data: missingNames.map(name => ({ tenantId, externalId: `REFERENCE:${name}`, supplierCode: name, name, status: 'REFERENCE_ONLY', currency: 'CNY' })), skipDuplicates: true })
    for (const name of missingNames) supplierByName.set(name, name)
  }
  const groups = new Map<string, SourceRow[]>()
  for (const row of rows) {
    const rawNumber = text(row['单据编号'])
    const poNumber = rawNumber.match(/^PO\d+/)?.[0] ?? rawNumber
    if (!poNumber) continue
    const group = groups.get(poNumber) ?? []
    group.push(row); groups.set(poNumber, group)
  }
  await prisma.$transaction(async tx => {
    await tx.erpSimPurchaseOrder.deleteMany({ where: { tenantId } })
    for (const [poNumber, poRows] of groups) {
      const first = poRows[0]
      const supplierName = text(first['供应商'])
      const closed = text(first['关闭状态']).includes('关闭') || text(first['业务关闭']).includes('关闭')
      await tx.erpSimPurchaseOrder.create({ data: {
        tenantId,
        externalId: poNumber,
        poNumber,
        supplierCode: supplierByName.get(supplierName) ?? supplierName,
        currency: 'CNY',
        orderDate: new Date(dateOnly(first['采购日期'])),
        requestedDate: new Date(dateOnly(first['交货日期'])),
        status: closed ? 'CLOSED' : 'OPEN',
        lines: { create: poRows.map((row, index) => ({ lineNo: index + 1, materialCode: text(row['物料编码']), qty: decimal(row['采购数量']), unitPrice: decimal(row['单价']), requestedDate: new Date(dateOnly(row['交货日期'])), confirmedQty: decimal(row['累计收料数量']) })) },
      } })
    }
  }, { timeout: 55_000 })
  return { recordsImported: groups.size, inferredMaterials, inferredSuppliers: missingNames.length, warnings: [inferredMaterials ? `从 PO 引用自动补建 ${inferredMaterials} 条 REFERENCE_ONLY 物料` : '', missingNames.length ? `从 PO 供应商名称自动补建 ${missingNames.length} 条 REFERENCE_ONLY 供应商` : ''].filter(Boolean) }
}

export async function importCustomerSnapshot(tenantId: string, type: CustomerSnapshotType, buffer: Buffer): Promise<CustomerSnapshotReport> {
  if (!/^[a-zA-Z0-9_-]{2,64}$/.test(tenantId)) throw new Error('Invalid tenantId')
  const rows = parseRows(buffer)
  if (!rows.length) throw new Error('Excel 文件没有可导入的数据行')
  await ensureTenant(tenantId)
  const result = type === 'MATERIAL' ? await importMaterials(tenantId, rows)
    : type === 'SUPPLIER' ? await importSuppliers(tenantId, rows)
      : type === 'CUSTOMER' ? await importCustomers(tenantId, rows)
        : type === 'INVENTORY' ? await importInventory(tenantId, rows)
          : type === 'EXCESS' ? await importExcess(tenantId, rows)
            : await importPurchaseOrders(tenantId, rows)
  await prisma.erpSimAuditLog.create({ data: { id: randomUUID(), tenantId, timestamp: new Date(), actor: 'erp-lab-user', action: 'IMPORT_CUSTOMER_SNAPSHOT', entityType: type, result: 'SUCCESS', details: JSON.stringify({ rowsRead: rows.length, ...result }) } })
  return { type, rowsRead: rows.length, ...result }
}
