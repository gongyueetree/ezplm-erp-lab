import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowRight, Boxes, Check, ChevronDown, CircleDollarSign,
  ClipboardCheck, CloudCog, Database, Download, FileSpreadsheet, Gauge, History,
  LayoutDashboard, Link2, ListRestart, LoaderCircle, PackageCheck, Play, Plus,
  RefreshCw, Search, Settings2, ShieldCheck, ShoppingCart, TestTube2,
  UploadCloud, Users, Warehouse, X, Zap,
} from 'lucide-react'
import { HttpErpLabProvider } from './lib/providers/erp/http'
import { createSeedDataset } from './lib/providers/erp/simulator/seed'
import { SCENARIO_META } from './lib/providers/erp/simulator/scenario-engine'
import { importRows, suggestMappings, TARGET_FIELDS } from './lib/providers/erp/simulator/importer'
import type { DatasetType, MappingProfile, ScenarioCode, SimulatorDataset } from './lib/providers/erp/types'

type Page = 'overview' | 'data' | 'import' | 'scenarios' | 'logs' | 'tests'
type TestResult = { name: string; status: 'running' | 'passed' | 'failed'; detail: string; ms?: number }

const tenantId = import.meta.env.VITE_DEFAULT_TENANT || 'ezplm-demo'

function App() {
  const provider = useMemo(() => new HttpErpLabProvider(tenantId), [])
  const [dataset, setDataset] = useState<SimulatorDataset>(() => createSeedDataset(tenantId))
  const [page, setPage] = useState<Page>('overview')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [poOpen, setPoOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    try { setDataset(await provider.getDataset()) }
    catch (error) { notify('error', `数据库未就绪：${(error as Error).message}`) }
  }
  const notify = (type: 'success' | 'error', text: string) => {
    setToast({ type, text })
    window.setTimeout(() => setToast(null), 3400)
  }

  useEffect(() => {
    let active = true
    provider.getDataset().then(remote => { if (active) setDataset(remote) }).catch(error => { if (active) setToast({ type: 'error', text: `数据库未就绪：${error.message}` }) })
    return () => { active = false }
  }, [provider])

  const activateScenario = async (code: ScenarioCode, latencyMs?: number, failureRate?: number) => {
    await provider.setScenario({ code, enabled: true, latencyMs: latencyMs ?? (code === 'SLOW_ERP' ? 1800 : 0), failureRate: failureRate ?? 1 })
    await refresh()
    notify('success', `已切换到 ${SCENARIO_META.find(item => item.code === code)?.label}`)
  }

  const reset = async () => {
    await provider.resetDataset()
    await refresh()
    notify('success', 'Golden Dataset 已恢复')
  }

  const exportDataset = () => {
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ezplm-erp-snapshot-${dataset.tenantId}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} />
      <main className="main-area">
        <Topbar dataset={dataset} onScenario={() => setPage('scenarios')} onSettings={() => setAuthOpen(true)} authenticated={provider.hasAccessToken()} />
        <div className="page-wrap">
          {page === 'overview' && <Overview dataset={dataset} provider={provider} refresh={refresh} notify={notify} setPage={setPage} reset={reset} exportDataset={exportDataset} setPoOpen={setPoOpen} />}
          {page === 'data' && <DataExplorer dataset={dataset} />}
          {page === 'import' && <SnapshotImporter dataset={dataset} provider={provider} refresh={refresh} notify={notify} />}
          {page === 'scenarios' && <Scenarios dataset={dataset} activate={activateScenario} />}
          {page === 'logs' && <Logs dataset={dataset} />}
          {page === 'tests' && <TestConsole provider={provider} dataset={dataset} activate={activateScenario} refresh={refresh} />}
        </div>
      </main>
      {poOpen && <CreatePoModal dataset={dataset} provider={provider} close={() => setPoOpen(false)} refresh={refresh} notify={notify} busy={busy} setBusy={setBusy} />}
      {authOpen && <AccessModal provider={provider} close={() => setAuthOpen(false)} notify={notify} />}
      {toast && <div className={`toast ${toast.type}`}><span>{toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}</span>{toast.text}</div>}
    </div>
  )
}

function Sidebar({ page, setPage }: { page: Page; setPage: (page: Page) => void }) {
  const items: { id: Page; label: string; icon: typeof LayoutDashboard; badge?: string }[] = [
    { id: 'overview', label: '总览', icon: LayoutDashboard },
    { id: 'data', label: '数据浏览器', icon: Database },
    { id: 'import', label: '快照导入', icon: UploadCloud },
    { id: 'scenarios', label: '故障场景', icon: Zap, badge: '13' },
    { id: 'logs', label: '请求与审计', icon: History },
    { id: 'tests', label: '测试控制台', icon: TestTube2 },
  ]
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark"><span>e</span></div><div><strong>ezPLM</strong><small>ERP LAB</small></div></div>
    <div className="workspace-label">ERP 集成环境</div>
    <nav>{items.map(item => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}><item.icon size={18} /><span>{item.label}</span>{item.badge && <em>{item.badge}</em>}</button>)}</nav>
    <div className="sidebar-spacer" />
    <div className="lab-status"><div className="pulse-dot" /><div><strong>Simulator 在线</strong><small>PostgreSQL 共享数据 · v2.0</small></div></div>
    <div className="user-card"><div className="avatar">GY</div><div><strong>Gongyu</strong><small>Management</small></div><ChevronDown size={15} /></div>
  </aside>
}

function Topbar({ dataset, onScenario, onSettings, authenticated }: { dataset: SimulatorDataset; onScenario: () => void; onSettings: () => void; authenticated: boolean }) {
  const meta = SCENARIO_META.find(item => item.code === dataset.scenario.code)
  return <header className="topbar">
    <div className="breadcrumbs"><span>Settings</span><i>/</i><strong>Integrations</strong><i>/</i><b>ERP Sandbox</b></div>
    <div className="top-actions">
      <button className={`scenario-pill ${dataset.scenario.code !== 'NORMAL' ? 'danger' : ''}`} onClick={onScenario}><span />{meta?.label}<ChevronDown size={14} /></button>
      <div className="tenant"><span>租户</span><strong>{dataset.tenantId}</strong></div>
      <button className={`icon-btn ${authenticated ? 'authenticated' : ''}`} onClick={onSettings} title="管理访问凭证"><Settings2 size={18} /></button>
    </div>
  </header>
}

function Overview({ dataset, provider, refresh, notify, setPage, reset, exportDataset, setPoOpen }: any) {
  const [checking, setChecking] = useState(false)
  const counts = [
    { label: '物料主数据', value: dataset.materials.length, icon: Boxes, color: 'blue', trend: '100% 已映射' },
    { label: '库存记录', value: dataset.inventory.length, icon: Warehouse, color: 'teal', trend: `${dataset.inventory.filter((i: any) => Number(i.availableQty) > 0).length} 条可用` },
    { label: 'Excess 记录', value: dataset.excess.length, icon: PackageCheck, color: 'purple', trend: `${dataset.excess.reduce((s: number, i: any) => s + Number(i.availableQty), 0).toLocaleString()} PCS` },
    { label: 'Open PO', value: dataset.purchaseOrders.filter((po: any) => po.status !== 'CLOSED').length, icon: ShoppingCart, color: 'amber', trend: `${dataset.purchaseOrders.reduce((s: number, po: any) => s + po.lines.length, 0)} 个订单行` },
  ]
  const check = async () => {
    setChecking(true)
    try { const r = await provider.testConnection(); notify('success', r.message); await refresh() } catch (e) { notify('error', (e as Error).message); await refresh() }
    setChecking(false)
  }
  const success = dataset.requestLogs.length ? Math.round(dataset.requestLogs.filter((l: any) => l.result === 'SUCCESS').length / dataset.requestLogs.length * 100) : 100
  return <>
    <section className="page-heading"><div><div className="eyebrow"><span>SIMULATOR</span> 金蝶 K3 云星空兼容测试环境</div><h1>ERP Sandbox</h1><p>在接入客户真实 ERP 前，安全验证数据同步、PO 写入、故障恢复与幂等逻辑。</p></div><div className="heading-actions"><button className="btn secondary" onClick={exportDataset}><Download size={16} />导出数据集</button><button className="btn primary" onClick={() => setPoOpen(true)}><Plus size={17} />模拟创建 PO</button></div></section>
    <section className="connection-card">
      <div className="connection-icon"><Link2 size={22} /></div><div className="connection-copy"><div><h3>Kingdee Simulator</h3><span className="online"><i />连接正常</span></div><p>Provider: <code>simulator</code><b>·</b> Dataset: {dataset.datasetName}<b>·</b> Seed: {new Date(dataset.seededAt).toLocaleDateString('zh-CN')}</p></div>
      <button className="btn ghost" onClick={check} disabled={checking}>{checking ? <LoaderCircle className="spin" size={16} /> : <Activity size={16} />}测试连接</button>
    </section>
    <section className="metric-grid">{counts.map(item => <div className="metric-card" key={item.label}><div className={`metric-icon ${item.color}`}><item.icon size={21} /></div><div className="metric-value">{item.value.toLocaleString()}</div><div className="metric-label">{item.label}</div><div className="metric-trend"><Check size={13} />{item.trend}</div></div>)}</section>
    <section className="dashboard-grid">
      <div className="panel health-panel"><PanelTitle icon={Gauge} title="ERP Mapping Health" action="查看数据" onAction={() => setPage('data')} />
        <div className="health-score"><div className="ring"><strong>97.4%</strong><span>总体健康度</span></div><div className="health-bars"><Health label="Internal PN mapped" value={96.8} /><Health label="Supplier mapped" value={100} /><Health label="Customer mapped" value={100} /><Health label="Open PO mapped" value={93.6} /></div></div>
        <div className="panel-note"><AlertTriangle size={15} /><span>有 <strong>2 个采购单行</strong>尚未关联内部采购需求</span><ArrowRight size={15} /></div>
      </div>
      <div className="panel activity-panel"><PanelTitle icon={History} title="最近请求" action="查看全部" onAction={() => setPage('logs')} />
        <div className="activity-list">{dataset.requestLogs.length === 0 ? <EmptyState icon={CloudCog} text="还没有请求记录，先测试一次连接" /> : dataset.requestLogs.slice(0, 5).map((log: any) => <div className="activity-row" key={log.id}><span className={`status-icon ${log.result === 'SUCCESS' ? 'ok' : 'bad'}`}>{log.result === 'SUCCESS' ? <Check size={13} /> : <X size={13} />}</span><div><strong>{humanOperation(log.operation)}</strong><small>{log.scenario} · {log.latency} ms</small></div><time>{relativeTime(log.timestamp)}</time></div>)}</div>
        <div className="success-row"><span>请求成功率</span><div><i style={{ width: `${success}%` }} /></div><strong>{success}%</strong></div>
      </div>
    </section>
    <section className="quick-section"><div className="section-title"><h2>快速操作</h2><p>管理模拟数据并验证集成链路</p></div><div className="quick-grid">
      <Quick icon={FileSpreadsheet} title="导入 ERP 快照" text="上传脱敏 Excel / CSV 数据" onClick={() => setPage('import')} />
      <Quick icon={Zap} title="注入故障" text="测试超时、限流与断网恢复" onClick={() => setPage('scenarios')} />
      <Quick icon={TestTube2} title="运行场景测试" text="执行 Contract 与 E2E 测试" onClick={() => setPage('tests')} />
      <Quick icon={ListRestart} title="重置 Golden Dataset" text="恢复到标准演示数据" onClick={reset} />
    </div></section>
  </>
}

function PanelTitle({ icon: Icon, title, action, onAction }: any) { return <div className="panel-title"><div><Icon size={18} /><h3>{title}</h3></div><button onClick={onAction}>{action}<ArrowRight size={14} /></button></div> }
function Health({ label, value }: { label: string; value: number }) { return <div className="health-item"><div><span>{label}</span><strong>{value}%</strong></div><div className="bar"><i style={{ width: `${value}%` }} /></div></div> }
function Quick({ icon: Icon, title, text, onClick }: any) { return <button className="quick-card" onClick={onClick}><span><Icon size={19} /></span><div><strong>{title}</strong><small>{text}</small></div><ArrowRight size={16} /></button> }
function EmptyState({ icon: Icon, text }: any) { return <div className="empty-mini"><Icon size={28} /><span>{text}</span></div> }

const datasetTabs: { id: DatasetType; label: string; field: keyof SimulatorDataset }[] = [
  { id: 'MATERIAL', label: '物料', field: 'materials' }, { id: 'INVENTORY', label: '库存', field: 'inventory' },
  { id: 'EXCESS', label: 'Excess', field: 'excess' }, { id: 'SUPPLIER', label: '供应商', field: 'suppliers' },
  { id: 'CUSTOMER', label: '客户', field: 'customers' }, { id: 'OPEN_PO', label: 'Open PO', field: 'purchaseOrders' },
  { id: 'FX', label: '汇率', field: 'exchangeRates' },
]

function DataExplorer({ dataset }: { dataset: SimulatorDataset }) {
  const [active, setActive] = useState<DatasetType>('MATERIAL')
  const [search, setSearch] = useState('')
  const tab = datasetTabs.find(item => item.id === active)!
  const raw = dataset[tab.field] as unknown[]
  const rows = raw.filter(row => JSON.stringify(row).toLowerCase().includes(search.toLowerCase())) as Record<string, any>[]
  const columns = rows.length ? Object.keys(rows[0]).filter(key => !['lines', 'idempotencyKey'].includes(key)).slice(0, 8) : []
  return <><PageHeader eyebrow="DATASET EXPLORER" title="ERP 数据浏览器" text="检查标准化后的 Canonical ERP 数据；所有数量与金额均以 Decimal String 保存。" />
    <div className="panel data-panel"><div className="data-toolbar"><div className="tab-list">{datasetTabs.map(item => <button className={active === item.id ? 'active' : ''} onClick={() => setActive(item.id)} key={item.id}>{item.label}<em>{(dataset[item.field] as unknown[]).length}</em></button>)}</div><label className="search-box"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索当前数据集…" /></label></div>
      <div className="table-wrap"><table><thead><tr>{columns.map(column => <th key={column}>{prettyKey(column)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(column => <td key={column}>{column.includes('status') ? <span className="status-tag">{String(row[column] ?? '—')}</span> : String(row[column] ?? '—')}</td>)}</tr>)}</tbody></table></div>
      <div className="table-footer"><span>显示 {rows.length} / {raw.length} 条记录</span><span>Tenant: <code>{dataset.tenantId}</code></span></div>
    </div></>
}

function SnapshotImporter({ dataset, provider, refresh, notify }: any) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<DatasetType>('MATERIAL')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [mappings, setMappings] = useState<MappingProfile['mappings']>([])
  const [replace, setReplace] = useState(true)
  const [report, setReport] = useState<any>(null)
  const parse = async (file: File) => {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: '' })
    setFileName(file.name); setRows(parsed); setMappings(suggestMappings(parsed.length ? Object.keys(parsed[0]) : [], type)); setReport(null)
  }
  const confirm = async () => {
    const result = importRows(dataset, type, rows, mappings, replace)
    setReport(result.report)
    if (!result.report.errors.length && !result.report.brokenReferences.length) {
      await provider.replaceDataset(result.dataset); await refresh(); notify('success', `成功导入 ${result.report.rowsImported} 条记录`)
    } else notify('error', '导入被阻止，请处理校验错误或断开的引用')
  }
  return <><PageHeader eyebrow="SNAPSHOT IMPORTER" title="导入脱敏 ERP 快照" text="先选择数据集、确认字段映射和完整性，再写入 Simulator。原始文件不会上传到服务器。" />
    <div className="import-layout"><div className="panel import-main"><div className="step-head"><span>1</span><div><h3>选择数据集与文件</h3><p>支持 .xlsx、.xls、.csv 和 .json</p></div></div>
      <div className="dataset-select">{datasetTabs.map(item => <button key={item.id} className={type === item.id ? 'active' : ''} onClick={() => { setType(item.id); setRows([]); setFileName('') }}>{item.label}</button>)}</div>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv,.json" hidden onChange={e => e.target.files?.[0] && parse(e.target.files[0])} />
      <button className={`drop-zone ${fileName ? 'has-file' : ''}`} onClick={() => inputRef.current?.click()}>{fileName ? <><FileSpreadsheet size={32} /><strong>{fileName}</strong><span>{rows.length} 行 · 单击重新选择</span></> : <><UploadCloud size={34} /><strong>选择或拖入 ERP 快照</strong><span>文件仅在浏览器本地解析</span></>}</button>
      {rows.length > 0 && <><div className="step-head spaced"><span>2</span><div><h3>确认字段映射</h3><p>系统只做建议，不会静默导入未映射字段</p></div></div><div className="mapping-table"><div className="mapping-row head"><span>源列</span><span>Canonical 字段</span><span>示例值</span></div>{mappings.map((mapping, index) => <div className="mapping-row" key={mapping.sourceColumn}><code>{mapping.sourceColumn}</code><select value={mapping.targetField} onChange={e => setMappings(current => current.map((item, i) => i === index ? { ...item, targetField: e.target.value } : item))}><option value="">不导入</option>{TARGET_FIELDS[type].map(field => <option key={field} value={field}>{field}</option>)}</select><span>{String(rows[0][mapping.sourceColumn] ?? '—')}</span></div>)}</div>
        <div className="import-actions"><label><input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />替换当前数据集</label><button className="btn primary" onClick={confirm}><ClipboardCheck size={17} />校验并导入</button></div></>}
    </div><aside className="panel import-aside"><h3><ShieldCheck size={18} />导入安全检查</h3><ul><li><Check />租户隔离</li><li><Check />必填字段验证</li><li><Check />物料引用完整性</li><li><Check />供应商引用完整性</li><li><Check />Decimal String 规范化</li><li><Check />禁止 silent drop</li></ul>{report && <div className={`report ${report.errors.length || report.brokenReferences.length ? 'bad' : 'good'}`}><strong>导入报告</strong><span>读取 {report.rowsRead} 行</span><span>导入 {report.rowsImported} 行</span><span>字段错误 {report.errors.length}</span><span>断开引用 {report.brokenReferences.length}</span>{[...report.errors, ...report.brokenReferences.map((b: any) => `第 ${b.row} 行：${b.type} ${b.value}`)].slice(0, 5).map((e: string) => <small key={e}>{e}</small>)}</div>}</aside></div>
  </>
}

function Scenarios({ dataset, activate }: { dataset: SimulatorDataset; activate: (code: ScenarioCode, latency?: number, rate?: number) => void }) {
  const [latency, setLatency] = useState(dataset.scenario.latencyMs || 1800)
  const [rate, setRate] = useState(Math.round((dataset.scenario.failureRate || 1) * 100))
  return <><PageHeader eyebrow="FAILURE INJECTION" title="故障场景引擎" text="可重复模拟真实 ERP 异常，验证重试、降级、审计和幂等处理。" />
    <div className="scenario-summary"><div><span className={dataset.scenario.code === 'NORMAL' ? 'ok' : 'warn'}><Zap size={18} /></span><div><small>当前模式</small><strong>{SCENARIO_META.find(item => item.code === dataset.scenario.code)?.label}</strong></div></div><p>{SCENARIO_META.find(item => item.code === dataset.scenario.code)?.description}</p><button className="btn secondary" onClick={() => activate('NORMAL', 120, 0)}><RefreshCw size={15} />恢复正常</button></div>
    <div className="scenario-config"><label>延迟 <strong>{latency} ms</strong><input type="range" min="0" max="3000" step="100" value={latency} onChange={e => setLatency(Number(e.target.value))} /></label><label>触发概率 <strong>{rate}%</strong><input type="range" min="10" max="100" step="10" value={rate} onChange={e => setRate(Number(e.target.value))} /></label></div>
    <div className="scenario-grid">{SCENARIO_META.map(item => <button key={item.code} className={`scenario-card ${dataset.scenario.code === item.code ? 'active' : ''}`} onClick={() => activate(item.code, item.code === 'SLOW_ERP' ? latency : 0, rate / 100)}><span className={`scenario-symbol ${item.tone}`}><ScenarioIcon code={item.code} /></span><div><strong>{item.label}</strong><small>{item.code}</small><p>{item.description}</p></div><i>{dataset.scenario.code === item.code ? <Check size={14} /> : <Play size={13} />}</i></button>)}</div>
  </>
}

function ScenarioIcon({ code }: { code: ScenarioCode }) { return code === 'NORMAL' ? <ShieldCheck /> : code.includes('NETWORK') ? <CloudCog /> : code.includes('PO') || code === 'DUPLICATE_PO' ? <ShoppingCart /> : code.includes('MATERIAL') ? <Boxes /> : code.includes('SUPPLIER') ? <Users /> : code.includes('FX') ? <CircleDollarSign /> : <AlertTriangle /> }

function Logs({ dataset }: { dataset: SimulatorDataset }) {
  const [kind, setKind] = useState<'request' | 'audit'>('request')
  return <><PageHeader eyebrow="TRACE & AUDIT" title="请求与审计日志" text="每次 ERP 调用和写操作均可追溯；凭据与 Token 永不写入日志。" />
    <div className="panel logs-panel"><div className="log-tabs"><button className={kind === 'request' ? 'active' : ''} onClick={() => setKind('request')}>Request Log <em>{dataset.requestLogs.length}</em></button><button className={kind === 'audit' ? 'active' : ''} onClick={() => setKind('audit')}>Audit Log <em>{dataset.auditLogs.length}</em></button></div>
      {kind === 'request' ? <div className="table-wrap"><table><thead><tr><th>结果</th><th>操作</th><th>场景</th><th>延迟</th><th>错误码</th><th>时间</th><th>Request ID</th></tr></thead><tbody>{dataset.requestLogs.map(log => <tr key={log.id}><td><span className={`result ${log.result === 'SUCCESS' ? 'success' : log.result === 'COMMITTED_NO_RESPONSE' ? 'warning' : 'failed'}`}>{log.result}</span></td><td><strong>{humanOperation(log.operation)}</strong></td><td><code>{log.scenario}</code></td><td>{log.latency} ms</td><td>{log.errorCode || '—'}</td><td>{new Date(log.timestamp).toLocaleString('zh-CN')}</td><td><code className="muted-code">{log.requestId.slice(0, 8)}</code></td></tr>)}</tbody></table>{dataset.requestLogs.length === 0 && <EmptyState icon={History} text="暂无请求日志" />}</div> : <div className="table-wrap"><table><thead><tr><th>结果</th><th>动作</th><th>对象</th><th>对象 ID</th><th>操作者</th><th>时间</th><th>详情</th></tr></thead><tbody>{dataset.auditLogs.map(log => <tr key={log.id}><td><span className="result success">{log.result}</span></td><td><strong>{log.action}</strong></td><td>{log.entityType}</td><td><code>{log.entityId || '—'}</code></td><td>{log.actor}</td><td>{new Date(log.timestamp).toLocaleString('zh-CN')}</td><td>{log.details || '—'}</td></tr>)}</tbody></table>{dataset.auditLogs.length === 0 && <EmptyState icon={ShieldCheck} text="暂无写操作审计记录" />}</div>}
    </div></>
}

function TestConsole({ provider, dataset, activate, refresh }: any) {
  const [results, setResults] = useState<TestResult[]>([])
  const [running, setRunning] = useState(false)
  const tests = [
    { name: 'ERP-CT-001 · Provider 连接契约', run: () => provider.testConnection() },
    { name: 'ERP-CT-002 · Canonical 主数据读取', run: async () => { const r = await provider.pullMaterials(); if (!r.length) throw new Error('无物料数据') } },
    { name: 'ERP-CT-003 · Inventory / Excess / FX', run: async () => Promise.all([provider.pullInventory(), provider.pullExcess(), provider.pullExchangeRates()]) },
    { name: 'ERP-E2E-004 · PO 创建与审计', run: () => createTestPo(provider, `test-${Date.now()}`) },
    { name: 'ERP-E2E-007 · Network Drop After Commit', run: async () => {
      const key = `network-drop-${Date.now()}`; activate('NETWORK_DROP_AFTER_COMMIT', 0, 1)
      try { await createTestPo(provider, key) } catch (e) { if ((e as any).code !== 'NETWORK_DROP_AFTER_COMMIT') throw e }
      const replay = await createTestPo(provider, key); if (!replay.idempotentReplay) throw new Error('重试没有命中幂等记录')
      activate('NORMAL', 0, 0)
    } },
    { name: 'ERP-E2E-008 · ETA 更新', run: async () => { const current = await provider.getDataset(); return provider.updateEta({ poExternalId: current.purchaseOrders[0].externalId, lineNo: 1, eta: '2026-09-20', confirmedQty: '1000' }) } },
  ]
  const runAll = async () => {
    setRunning(true); activate('NORMAL', 0, 0); setResults(tests.map(test => ({ name: test.name, status: 'running', detail: '等待执行' })))
    for (let i = 0; i < tests.length; i++) {
      const started = performance.now()
      try { await tests[i].run(); setResults(current => current.map((r, j) => j === i ? { ...r, status: 'passed', detail: '通过', ms: Math.round(performance.now() - started) } : r)) }
      catch (e) { setResults(current => current.map((r, j) => j === i ? { ...r, status: 'failed', detail: (e as Error).message, ms: Math.round(performance.now() - started) } : r)) }
    }
    await activate('NORMAL', 120, 0); await refresh(); setRunning(false)
  }
  const passed = results.filter(r => r.status === 'passed').length
  return <><PageHeader eyebrow="AUTOMATED TEST SUITE" title="ERP 测试控制台" text="运行同一套 Provider Contract 与关键 E2E 链路，真实 Kingdee Provider 后续也必须通过。" action={<button className="btn primary" onClick={runAll} disabled={running}>{running ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}{running ? '正在运行…' : '运行全部测试'}</button>} />
    <div className="test-overview"><div><TestTube2 /><span><strong>{tests.length}</strong><small>测试用例</small></span></div><div><ShieldCheck /><span><strong>{passed}</strong><small>已通过</small></span></div><div><Activity /><span><strong>{results.filter(r => r.status === 'failed').length}</strong><small>失败</small></span></div><div><Database /><span><strong>{dataset.datasetName.split(' · ')[0]}</strong><small>当前数据集</small></span></div></div>
    <div className="panel test-panel"><div className="test-suite-title"><div><span>ERP</span><div><strong>Canonical Provider Test Suite</strong><small>Contract + Integration + E2E</small></div></div><code>VITEST / BROWSER RUNNER</code></div>
      <div className="test-list">{tests.map((test, index) => { const result = results[index]; return <div className="test-row" key={test.name}><span className={`test-check ${result?.status || 'idle'}`}>{result?.status === 'passed' ? <Check /> : result?.status === 'failed' ? <X /> : result?.status === 'running' ? <LoaderCircle className="spin" /> : <span>{index + 1}</span>}</span><div><strong>{test.name}</strong><small>{result?.detail || '尚未运行'}</small></div><time>{result?.ms ? `${result.ms} ms` : '—'}</time></div> })}</div>
    </div></>
}

async function createTestPo(provider: HttpErpLabProvider, key: string) {
  return provider.createPurchaseOrder({ supplierCode: 'SUP-DIGIKEY', currency: 'USD', orderDate: new Date().toISOString().slice(0, 10), requestedDate: '2026-09-25', lines: [{ lineNo: 1, materialCode: 'EZ-ADS131M04', qty: '25', unitPrice: '13.85' }] }, key)
}

function CreatePoModal({ dataset, provider, close, refresh, notify, busy, setBusy }: any) {
  const formId = useId().replaceAll(':', '')
  const [supplier, setSupplier] = useState(dataset.suppliers[0]?.supplierCode || '')
  const [material, setMaterial] = useState(dataset.materials[0]?.materialCode || '')
  const [qty, setQty] = useState('100')
  const [price, setPrice] = useState('1.00')
  const [key, setKey] = useState(`PR-DEMO-${formId}`)
  const submit = async () => {
    setBusy(true)
    try { const r = await provider.createPurchaseOrder({ supplierCode: supplier, currency: dataset.suppliers.find((s: any) => s.supplierCode === supplier)?.currency || 'CNY', orderDate: new Date().toISOString().slice(0, 10), requestedDate: '2026-09-30', lines: [{ lineNo: 1, materialCode: material, qty, unitPrice: price }] }, key); notify('success', r.idempotentReplay ? `幂等重放：${r.documentNumber}` : `PO 已创建：${r.documentNumber}`); await refresh(); close() }
    catch (e) { notify('error', `${(e as any).code || 'ERROR'} · ${(e as Error).message}`); await refresh() }
    setBusy(false)
  }
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><div className="modal"><div className="modal-head"><div><span><ShoppingCart size={20} /></span><div><h2>模拟创建采购单</h2><p>所有写操作都会生成 AuditLog</p></div></div><button onClick={close}><X size={19} /></button></div><div className="modal-body"><label>供应商<select value={supplier} onChange={e => setSupplier(e.target.value)}>{dataset.suppliers.map((s: any) => <option value={s.supplierCode} key={s.supplierCode}>{s.name} · {s.supplierCode}</option>)}</select></label><label>物料<select value={material} onChange={e => setMaterial(e.target.value)}>{dataset.materials.map((m: any) => <option value={m.materialCode} key={m.materialCode}>{m.materialCode} · {m.mpn}</option>)}</select></label><div className="form-row"><label>数量<input value={qty} onChange={e => setQty(e.target.value)} /></label><label>单价<input value={price} onChange={e => setPrice(e.target.value)} /></label></div><label>Idempotency-Key<input value={key} onChange={e => setKey(e.target.value)} /><small>使用相同 Key 重试时，Simulator 返回首次创建的 PO。</small></label><div className="warning-box"><ShieldCheck size={17} /><span>场景 <strong>{dataset.scenario.code}</strong> 将应用于本次请求</span></div></div><div className="modal-actions"><button className="btn secondary" onClick={close}>取消</button><button className="btn primary" onClick={submit} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <ShoppingCart size={16} />}创建 PO</button></div></div></div>
}

function AccessModal({ provider, close, notify }: { provider: HttpErpLabProvider; close: () => void; notify: (type: 'success' | 'error', text: string) => void }) {
  const [token, setToken] = useState('')
  const save = () => {
    if (!token.trim()) { notify('error', '请输入 ERP Lab 管理凭证'); return }
    provider.setAccessToken(token); notify('success', '管理凭证已保存到当前浏览器会话'); close()
  }
  const clear = () => { provider.clearAccessToken(); notify('success', '管理凭证已清除'); close() }
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}><div className="modal access-modal"><div className="modal-head"><div><span><ShieldCheck size={20} /></span><div><h2>ERP Lab 管理访问</h2><p>凭证仅保存在当前浏览器 sessionStorage</p></div></div><button onClick={close}><X size={19} /></button></div><div className="modal-body"><label>管理凭证<input type="password" autoComplete="current-password" value={token} onChange={e => setToken(e.target.value)} placeholder="ERP_LAB_ACCESS_TOKEN" /><small>用于场景切换、数据导入、重置、PO 和 ETA 写入；不会写入 Git 或数据库日志。</small></label><div className="warning-box"><ShieldCheck size={17} /><span>公开访问者可以查看数据，但没有凭证不能修改共享数据库。</span></div></div><div className="modal-actions"><button className="btn secondary" onClick={clear}>清除凭证</button><button className="btn primary" onClick={save}><ShieldCheck size={16} />保存到本次会话</button></div></div></div>
}

function PageHeader({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: React.ReactNode }) { return <section className="page-heading compact"><div><div className="eyebrow"><span>{eyebrow}</span></div><h1>{title}</h1><p>{text}</p></div>{action}</section> }
function prettyKey(key: string) { return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()) }
function humanOperation(op: string) { return ({ testConnection: '测试连接', pullMaterials: '读取物料', pullInventory: '同步库存', pullExcess: '同步 Excess', pullSuppliers: '读取供应商', pullCustomers: '读取客户', pullExchangeRates: '同步汇率', pullOpenPurchaseOrders: '读取 Open PO', createPurchaseOrder: '创建采购单', updateEta: '更新 ETA' } as Record<string, string>)[op] || op }
function relativeTime(value: string) { const s = Math.floor((Date.now() - new Date(value).getTime()) / 1000); if (s < 60) return `${Math.max(0, s)} 秒前`; if (s < 3600) return `${Math.floor(s / 60)} 分钟前`; return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }

export default App
