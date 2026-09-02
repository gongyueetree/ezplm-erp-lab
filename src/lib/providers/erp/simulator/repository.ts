import { createSeedDataset } from './seed'
import type { SimulatorDataset } from '../types'

export interface SimulatorRepository {
  load(): SimulatorDataset
  save(dataset: SimulatorDataset): void
  reset(): SimulatorDataset
}

export class MemorySimulatorRepository implements SimulatorRepository {
  private dataset: SimulatorDataset

  constructor(public readonly tenantId = 'ezplm-demo', initial?: SimulatorDataset) {
    this.dataset = structuredClone(initial ?? createSeedDataset(tenantId))
  }

  load() { return structuredClone(this.dataset) }
  save(dataset: SimulatorDataset) { this.dataset = structuredClone(dataset) }
  reset() {
    this.dataset = createSeedDataset(this.tenantId)
    return this.load()
  }
}

export class BrowserSimulatorRepository implements SimulatorRepository {
  private readonly key: string

  constructor(public readonly tenantId = 'ezplm-demo') {
    this.key = `ezplm:erp-lab:v1:${tenantId}`
  }

  load(): SimulatorDataset {
    const raw = localStorage.getItem(this.key)
    if (!raw) return this.reset()
    try {
      const parsed = JSON.parse(raw) as SimulatorDataset
      if (parsed.tenantId !== this.tenantId) return this.reset()
      return parsed
    } catch {
      return this.reset()
    }
  }

  save(dataset: SimulatorDataset) {
    if (dataset.tenantId !== this.tenantId) throw new Error('Tenant isolation violation')
    localStorage.setItem(this.key, JSON.stringify(dataset))
  }

  reset() {
    const dataset = createSeedDataset(this.tenantId)
    this.save(dataset)
    return dataset
  }
}
