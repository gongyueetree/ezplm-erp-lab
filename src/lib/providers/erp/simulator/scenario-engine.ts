import { ErpProviderError } from '../types'
import type { ErpSimScenario } from '../types'

export const SCENARIO_META = [
  { code: 'NORMAL', label: '正常模式', description: '所有接口正常响应', tone: 'green' },
  { code: 'SLOW_ERP', label: '慢速 ERP', description: '每次调用增加可配置延迟', tone: 'amber' },
  { code: 'AUTH_EXPIRED', label: '认证过期', description: '模拟 Token 失效 / HTTP 401', tone: 'red' },
  { code: 'TIMEOUT', label: '请求超时', description: '模拟上游 ERP 超时', tone: 'red' },
  { code: 'RATE_LIMIT', label: '限流', description: '模拟 HTTP 429，需要退避重试', tone: 'amber' },
  { code: 'PARTIAL_RESPONSE', label: '部分响应', description: '读取接口仅返回部分记录', tone: 'amber' },
  { code: 'NETWORK_DROP_AFTER_COMMIT', label: '提交后断网', description: 'PO 已写入，但客户端收不到响应', tone: 'red' },
  { code: 'DUPLICATE_PO', label: '重复 PO', description: '强制触发重复单据冲突', tone: 'red' },
  { code: 'MATERIAL_NOT_FOUND', label: '物料缺失', description: '读取结果隐藏一个关键物料', tone: 'amber' },
  { code: 'SUPPLIER_NOT_FOUND', label: '供应商缺失', description: '创建 PO 时供应商校验失败', tone: 'red' },
  { code: 'FX_MISSING', label: '汇率缺失', description: '汇率读取返回空集', tone: 'amber' },
  { code: 'PO_ALREADY_EXISTS', label: 'PO 已存在', description: '模拟 ERP 返回重复业务单据', tone: 'red' },
  { code: 'ERP_500', label: 'ERP 500', description: '模拟未知服务端错误', tone: 'red' },
] as const

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function beforeOperation(scenario: ErpSimScenario, operation: string) {
  if (!scenario.enabled || scenario.code === 'NORMAL') {
    if (scenario.latencyMs) await wait(Math.min(scenario.latencyMs, 300))
    return
  }
  if (scenario.targetOperation && scenario.targetOperation !== operation) return
  if (scenario.latencyMs) await wait(Math.min(scenario.latencyMs, 3000))
  if (scenario.failureRate > 0 && Math.random() > scenario.failureRate) return

  switch (scenario.code) {
    case 'AUTH_EXPIRED': throw new ErpProviderError('ERP_AUTH_EXPIRED', 'ERP 认证已过期', false, 401)
    case 'TIMEOUT': throw new ErpProviderError('ERP_TIMEOUT', 'ERP 请求超时', true, 504)
    case 'RATE_LIMIT': throw new ErpProviderError('ERP_RATE_LIMITED', 'ERP 请求过于频繁', true, 429)
    case 'ERP_500': throw new ErpProviderError('ERP_INTERNAL_ERROR', 'ERP 返回内部服务错误', true, 500)
    case 'DUPLICATE_PO':
    case 'PO_ALREADY_EXISTS':
      if (operation === 'createPurchaseOrder') throw new ErpProviderError('PO_ALREADY_EXISTS', 'ERP 中已存在相同采购单', false, 409)
      return
    case 'SUPPLIER_NOT_FOUND':
      if (operation === 'createPurchaseOrder') throw new ErpProviderError('SUPPLIER_NOT_FOUND', '供应商未在 ERP 中找到', false, 422)
      return
    default: return
  }
}
