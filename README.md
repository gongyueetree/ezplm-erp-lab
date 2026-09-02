# ezPLM ERP Lab

面向 ezPLM SMT/SCM Agent 的金蝶 ERP 集成测试环境。在没有客户真实金蝶账号和生产数据时，可完成主数据读取、库存/Excess/汇率/Open PO、PO 创建、ETA 更新、故障注入、审计和幂等重试验证。

## 已实现

- Canonical ERP DTO 与统一 `ErpProvider` Contract
- `KingdeeSimulatorProvider` 和可替换 Repository
- Material、Inventory、Excess、Supplier、Customer、FX、Open PO
- Excel / CSV / JSON 快照解析、人工字段映射、校验和 Broken Reference 报告
- 13 种场景：401、429、500、超时、部分响应、缺料、缺供应商、缺汇率、重复 PO 等
- Network Drop After Commit：先写入 PO、再模拟断网；同 Key 重试只返回原单
- PO 创建和 ETA 更新审计日志
- 请求日志、映射健康度、Golden Dataset、数据导出与重置
- Contract Test、Importer Test、端到端采购测试
- Vercel 静态部署配置与 GitHub Actions CI
- PostgreSQL/Prisma 持久化、Vercel Serverless API 与共享租户数据
- 数据维护工作台：单条新增/编辑/删除、批量 Excel/CSV 导入、引用校验与审计日志
- 数据库不可用时的明确状态页；不再以浏览器 seed 数据冒充远程数据

> 真实金蝶 Adapter 保持 `WAITING_FOR_DOCUMENTATION`。本仓库没有猜测任何金蝶 endpoint、字段名、认证协议或错误码。

## 本地运行

```bash
npm install
cp .env.example .env
npm run db:deploy
npm run dev
```

打开 `http://localhost:5173`。

## 验证

```bash
npm test
npm run test:erp
npm run test:e2e
npm run build
```

## Vercel 部署

项目是标准 Vite SPA，仓库根目录可直接导入 Vercel：

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Node.js: `22.x`

Vercel 项目需要配置两个服务端环境变量：

```env
DATABASE_URL=postgresql://...
ERP_LAB_ACCESS_TOKEN=<long-random-secret>
```

然后对目标数据库执行 `npm run db:deploy`。完整步骤见 [`docs/POSTGRESQL_DEPLOYMENT.md`](docs/POSTGRESQL_DEPLOYMENT.md)。

## 数据持久化说明

运行路径采用 `PrismaSimulatorRepository`：

- 浏览器通过同源 `/api/erp` 调用 Vercel Serverless Function；
- 数据保存在 PostgreSQL，多个浏览器共享同一租户数据；
- 每张 Simulator 表都包含 `tenantId` 并建立组合唯一键或索引；
- 数量、价格和汇率在 PostgreSQL 中使用 `DECIMAL`，Canonical API 返回 Decimal String；
- `MemorySimulatorRepository` 仅供 Contract/E2E 自动化测试使用。

公开访问者只能读取数据。场景切换、导入、重置、PO 和 ETA 写入需要 `ERP_LAB_ACCESS_TOKEN`，凭证只保存在浏览器 `sessionStorage`。

## 数据如何维护

| 场景 | 入口 | 说明 |
| --- | --- | --- |
| 日常单条维护 | 数据维护 → 选择数据集 → 新增/编辑/删除 | 适用于物料、库存、Excess、供应商、客户和汇率；服务端校验必填字段、Decimal String 和引用关系 |
| 批量初始化/更新 | 快照导入 | 浏览器本地解析 Excel/CSV/JSON，人工确认字段映射后写入 PostgreSQL，可选择替换或追加 |
| 采购单维护 | 数据维护 → Open PO / 总览 → 模拟创建 PO | 创建必须使用 Idempotency-Key；ETA 通过专用操作更新，不走通用记录编辑器 |
| 恢复标准数据 | 总览 → 重置 Golden Dataset | 覆盖当前租户数据，仅用于测试环境 |
| 变更追溯 | 请求与审计 | 新增、编辑、删除、导入、PO 与 ETA 写入均可审计 |

通用写入接口当前面向测试环境，采用“读取租户快照 → 校验 → 单事务保存”的方式。多人高频并发维护时，应在正式系统中升级为行级 CRUD、乐观锁和 RBAC。

## 目录

```text
src/lib/providers/erp/
├── types.ts                 # Canonical DTO / Decimal String
├── contracts.ts             # ErpProvider
├── factory.ts               # simulator / kingdee / none
├── kingdee/                 # WAITING_FOR_DOCUMENTATION
└── simulator/
    ├── index.ts             # Simulator Provider
    ├── repository.ts        # Browser + Memory Repository
    ├── scenario-engine.ts   # Failure Injection
    ├── importer.ts          # Snapshot Mapping / Validation
    └── seed.ts              # Golden Dataset
server/
├── prisma.ts                # Prisma Client singleton
└── prisma-simulator-repository.ts
api/erp.ts                   # Vercel Serverless API
prisma/                      # Schema + migrations
```

## 安全边界

- 客户私有 fixtures 在 `.gitignore` 中；
- 日志不保存密码或 Token；
- 所有写操作均生成 AuditLog；
- PO 写入必须带 Idempotency-Key；
- 真实 ERP credential 未来只能保存在服务端环境变量；
- 生产环境不得开放 Simulator Reset/Seed。
- PostgreSQL 和管理凭证不会打包进浏览器 JavaScript。

完整的实施前审计见 [`docs/ERP_LAB_IMPLEMENTATION_AUDIT.md`](docs/ERP_LAB_IMPLEMENTATION_AUDIT.md)。
