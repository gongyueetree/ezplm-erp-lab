import { describe, expect, it } from 'vitest'
import { createSeedDataset } from './seed'
import { importRows, suggestMappings } from './importer'

describe('Snapshot importer', () => {
  it('suggests canonical mappings but requires explicit confirmation', () => {
    const mappings = suggestMappings(['物料编码', 'externalId', 'MPN'], 'MATERIAL')
    expect(mappings.find(item => item.sourceColumn === '物料编码')?.targetField).toBe('materialCode')
    expect(mappings.find(item => item.sourceColumn === 'externalId')?.targetField).toBe('externalId')
  })

  it('blocks inventory rows with broken material references', () => {
    const dataset = createSeedDataset('tenant-a')
    const { dataset: output, report } = importRows(dataset, 'INVENTORY', [{ id: 'I-X', code: 'UNKNOWN-MAT', qty: 100 }], [
      { sourceColumn: 'id', targetField: 'externalId' }, { sourceColumn: 'code', targetField: 'materialCode' }, { sourceColumn: 'qty', targetField: 'onHandQty' },
    ])
    expect(report.brokenReferences).toHaveLength(1)
    expect(report.rowsImported).toBe(0)
    expect(output.inventory).toHaveLength(dataset.inventory.length)
  })

  it('does not silently accept rows missing required fields', () => {
    const dataset = createSeedDataset('tenant-a')
    const { report } = importRows(dataset, 'MATERIAL', [{ code: 'NEW-1' }], [{ sourceColumn: 'code', targetField: 'materialCode' }])
    expect(report.errors[0]).toContain('externalId')
    expect(report.rowsImported).toBe(0)
  })
})
