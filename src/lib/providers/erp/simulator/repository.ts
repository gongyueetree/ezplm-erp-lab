import { createSeedDataset } from './seed.js'
import type { SimulatorDataset } from '../types.js'

export interface SimulatorRepository {
  load(): Promise<SimulatorDataset>
  save(dataset: SimulatorDataset): Promise<void>
  reset(): Promise<SimulatorDataset>
}

export class MemorySimulatorRepository implements SimulatorRepository {
  private dataset: SimulatorDataset

  constructor(public readonly tenantId = 'ezplm-demo', initial?: SimulatorDataset) {
    this.dataset = structuredClone(initial ?? createSeedDataset(tenantId))
  }

  async load() { return structuredClone(this.dataset) }
  async save(dataset: SimulatorDataset) { this.dataset = structuredClone(dataset) }
  async reset() {
    this.dataset = createSeedDataset(this.tenantId)
    return this.load()
  }
}

export class BrowserSimulatorRepository implements SimulatorRepository {
  private readonly key: string

  constructor(public readonly tenantId = 'ezplm-demo') {
    this.key = `ezplm:erp-lab:v1:${tenantId}`
  }

  async load(): Promise<SimulatorDataset> {
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

  async save(dataset: SimulatorDataset) {
    if (dataset.tenantId !== this.tenantId) throw new Error('Tenant isolation violation')
    localStorage.setItem(this.key, JSON.stringify(dataset))
  }

  async reset() {
    const dataset = createSeedDataset(this.tenantId)
    await this.save(dataset)
    return dataset
  }
}
