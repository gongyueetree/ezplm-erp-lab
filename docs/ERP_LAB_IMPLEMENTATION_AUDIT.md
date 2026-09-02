# ERP Lab Implementation Audit

审计日期：2026-09-01

## 审计结论

本工作区仅包含《ezPLM ERP 测试环境技术实施方案》，没有可供审计的现有 ezPLM 代码仓库或 `main` 分支。因此本项目以独立仓库方式实现，避免假设或重复修改未知业务系统。

| 项目 | 结论 |
|---|---|
| 当前 main SHA | 新仓库，初始化提交前不存在 |
| 已有 ErpProvider | 无 |
| 已有 Kingdee Adapter | 无 |
| IntegrationJob / Sync State | 无 |
| Excess / FX / PO 模型 | 无 |
| AuditLog | 无 |
| 可复用代码 | 无；仅复用技术方案中的 Canonical Contract |
| 冲突与重复风险 | 当前独立仓库内无；接入 ezPLM 主仓库前需再次审计 |

## 实施决策

1. 建立统一 `ErpProvider`，业务能力只依赖 Canonical DTO。
2. Simulator 使用可替换 Repository；Vercel 演示版使用按租户隔离的浏览器持久化。
3. 真实 `KingdeeK3CloudProvider` 仅返回 `WAITING_FOR_DOCUMENTATION`，不猜测 endpoint、字段或认证协议。
4. PO 创建强制 `Idempotency-Key`，专门实现 Network Drop After Commit。
5. 每个读取请求写 Request Log；每个写操作写 AuditLog。
6. Snapshot Import 需要人工确认字段映射，Broken Reference 会阻止导入。

## 后续迁移风险

- 接入现有 ezPLM 主仓库时，必须重新审计其 Tenant、RBAC、AuditLog、PurchaseOrder 与 IntegrationJob 模型。
- 浏览器持久化适合演示和独立测试，不适合多人共享/UAT。进入客户协作阶段应将 `SimulatorRepository` 替换为 PostgreSQL/Prisma 实现。
- 客户脱敏快照不得进入公开 Git；`tests/private-fixtures/` 已被忽略。
- 生产环境必须在服务端强制禁用 Seed/Reset，不能只依赖前端隐藏。

## 推荐后续顺序

1. 将 Canonical Contract 作为单独 package 接入 ezPLM。
2. 实现 PostgreSQL Repository、租户/RBAC 和服务端 AuditLog。
3. 接入客户脱敏 Snapshot，运行 Acceptance Test。
4. 收到金蝶资料后实现真实 Provider，并复用本仓库 Contract Test。
