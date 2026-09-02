# PostgreSQL / Prisma 部署

## 架构

```text
Browser UI
   ↓ HTTPS /api/erp
Vercel Serverless Function
   ↓ Canonical ErpProvider
KingdeeSimulatorProvider
   ↓ SimulatorRepository
PrismaSimulatorRepository
   ↓
PostgreSQL
```

前端不直接连接数据库，`DATABASE_URL` 和 `ERP_LAB_ACCESS_TOKEN` 只存在于 Vercel 服务端环境。

## 1. 创建 PostgreSQL

可使用 Vercel Marketplace 中的 PostgreSQL 提供商，或任意支持 TLS 的 PostgreSQL 14+。Serverless 环境建议使用提供商的 pooled connection URL。

## 2. 配置环境变量

在 Vercel Project → Settings → Environment Variables 中添加：

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
ERP_LAB_ACCESS_TOKEN=<至少 32 字符的随机值>
```

对 Production、Preview 和 Development 分别确认作用域。不要创建 `VITE_DATABASE_URL`，否则数据库凭据会进入浏览器构建。

## 3. 执行迁移

首次数据库创建后，在安全的本地或 CI 环境执行：

```bash
npm ci
DATABASE_URL="postgresql://..." npm run db:deploy
```

迁移文件位于 `prisma/migrations/`，CI/生产使用 `prisma migrate deploy`，不要使用 `prisma db push` 替代正式迁移。

## 4. 重新部署并验证

完成环境变量和迁移后重新部署，验证：

1. GET `/api/erp?tenantId=ezplm-demo` 返回 Golden Dataset；
2. 在页面右上角设置按钮中输入管理凭证；
3. 测试连接并确认 RequestLog 增加；
4. 创建 PO 并确认第二个浏览器可以看到相同 PO；
5. 执行 Network Drop After Commit，使用相同 Idempotency-Key 重试；
6. 确认 PO 只创建一次且 AuditLog 完整。

## 5. 日常数据维护

- 少量变更：进入“数据维护”，选择物料、库存、Excess、供应商、客户或汇率后新增、编辑、删除；
- 大批量变更：进入“快照导入”，上传脱敏文件，检查字段映射与 Broken Reference 报告后再提交；
- Open PO：使用专用的 PO 创建和 ETA 更新流程，保留幂等与审计语义；
- 基准恢复：仅在测试租户使用“重置 Golden Dataset”；
- 权限：所有写入均要求 `ERP_LAB_ACCESS_TOKEN`，读取默认公开。

页面只有在 `/api/erp` 成功返回 PostgreSQL 数据后才展示表格。`DATABASE_URL` 缺失或函数异常时会显示配置/诊断页，避免把前端 seed 数据误认为数据库数据。

## 安全说明

- 当前 API 使用 `tenantId` 作为逻辑隔离键，并使用服务端管理凭证保护全部 POST 操作。
- 在并入 ezPLM 主系统时，应把共享凭证替换为正式 Session/RBAC，并从服务端身份中解析 tenantId，禁止信任客户端传入的 tenantId。
- 客户私有 Snapshot 不进入 Git；导入前仍需脱敏并检查 Referential Integrity。
