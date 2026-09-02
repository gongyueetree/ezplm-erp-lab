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

> 真实金蝶 Adapter 保持 `WAITING_FOR_DOCUMENTATION`。本仓库没有猜测任何金蝶 endpoint、字段名、认证协议或错误码。

## 本地运行

```bash
npm install
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

无需凭据即可运行 Simulator。可选环境变量：

```env
VITE_ERP_PROVIDER=simulator
VITE_DEFAULT_TENANT=ezplm-demo
```

## 数据持久化说明

当前在线演示版采用 `BrowserSimulatorRepository`：

- 数据保存在当前浏览器的 `localStorage`；
- storage key 包含 `tenantId`，不同租户逻辑隔离；
- 不上传客户快照，适合独立演示、产品评审和故障链路验证；
- 不适合多人共享数据、长期 UAT 或生产使用。

进入多人测试阶段时，实现同一 `SimulatorRepository` 的 PostgreSQL/Prisma 版本即可，Provider、UI 和 Contract Test 不需要重写。

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
```

## 安全边界

- 客户私有 fixtures 在 `.gitignore` 中；
- 日志不保存密码或 Token；
- 所有写操作均生成 AuditLog；
- PO 写入必须带 Idempotency-Key；
- 真实 ERP credential 未来只能保存在服务端环境变量；
- 生产环境不得开放 Simulator Reset/Seed。

完整的实施前审计见 [`docs/ERP_LAB_IMPLEMENTATION_AUDIT.md`](docs/ERP_LAB_IMPLEMENTATION_AUDIT.md)。
