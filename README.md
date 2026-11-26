# CDP Lite

轻量级客户数据平台业务应用。按照 [产品需求](docs/CDP_Lite_PRD.md) 与 [技术架构](docs/CDP_Lite_Technical_Architecture.md) 实现元数据配置与混合人群规则管理。

**当前版本保存人群规则定义，不计算用户集合，不提供人数预估、成员明细或分发。**

## 已实现

- 标签 / 属性：搜索、分页、创建、编辑、启停用、删除与枚举值管理。
- 行为模型：独立维度、数值指标、维度枚举值，父子归属与跨表字段编码唯一性校验。
- 人群：列表、创建、编辑、复制、删除、JSON 只读预览与乐观并发版本检查。
- 可视化规则编辑器：先选择类型，组内 AND、组间 OR；行为模型 → 时间 → 维度 → COUNT / SUM / AVG / MAX / MIN。
- AI 圈人：输入人群特点后，基于启用元数据生成直接映射或推导型规则草稿；展示代理信号、参数来源、歧义和未映射项，确认后可替换或追加到手工规则。
- 用户与权限：用户名密码登录、HttpOnly 会话 Cookie、登录限流、刷新恢复身份与安全注销；系统管理员可在设置页创建、更新、停用、重置密码或删除用户。
- 共享结构与值类型校验、服务端引用校验、事务内删除保护，以及定位到规则的错误反馈。
- MySQL 迁移与可重复执行的演示种子数据；本地 Chrome 端到端测试与隔离 MySQL 集成测试。
- 紧凑企业工作台：深色顶栏、上下文导航、高密度表格与配置表单，支持移动抽屉和键盘操作；视觉基线见 `docs/UI界面风格参考.png`。

## 技术栈

pnpm Workspace · TypeScript · React 18 · Vite · Ant Design 5 · TanStack Query · Koa 2 · Sequelize 6 · MySQL 8.4 · Zod。

表单统一使用 Ant Design Form，规则结构和业务语义使用共享 Zod / 纯函数校验；编辑草稿使用 React 局部 state，不引入第二套服务端数据缓存或全局状态库。

```text
apps/webapi/src/
  controllers/ → services/ → repositories/ → models/
  config/ middleware/ routes/ migrations/ schemas/ errors/ socket/
apps/webapp/src/
  app/ pages/ features/ components/ hooks/ lib/ styles/
packages/contracts/src/       DTO、结构 Schema、操作符与纯语义校验
docs/openapi.yaml             生成的 OpenAPI 3.1 文档
e2e/                         浏览器验收
```

## 快速启动

前置条件：Node.js 22.12+、pnpm 10.18.3、Docker Desktop（或者已配置好的 MySQL 8.x）。

```bash
pnpm install
cp .env.example .env
docker compose up -d --wait mysql
pnpm db:migrate
# 下一行回车后输入至少 12 位管理员密码，输入内容不会回显
read -rs CDP_ADMIN_PASSWORD
AUTH_ADMIN_PASSWORD="$CDP_ADMIN_PASSWORD" pnpm auth:set-admin
unset CDP_ADMIN_PASSWORD
pnpm db:seed
pnpm dev
```

访问 **http://localhost:5173**，使用用户名 `admin` 和上一步设置的密码登录。API 地址为 `http://127.0.0.1:3000/api/v1`，浏览器请求由 Vite 代理转发。

`auth:set-admin` 可重复执行，用于创建或重置管理员账号；执行后会使该账号已有会话全部失效。可用 `AUTH_ADMIN_USERNAME` 与 `AUTH_ADMIN_DISPLAY_NAME` 覆盖默认用户名和显示名称。密码使用带随机盐的 scrypt 哈希保存，浏览器只持有 HttpOnly Cookie，数据库只保存会话令牌的 SHA-256 摘要。

登录后，系统管理员可通过右上角齿轮进入“设置 → 用户管理”。`ADMIN` 与 `USER` 都可以使用现有业务功能，只有 `ADMIN` 可以调用用户管理接口。系统禁止删除当前登录用户、停用或降级自己，以及删除或停用最后一个可用管理员。

AI 圈人默认关闭，不影响手工规则编辑。启用 OpenAI-compatible Provider 时配置：

```dotenv
AI_RULE_GENERATION_ENABLED=true
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://your-provider.example/v1
AI_MODEL=your-model
AI_API_KEY=your-server-side-key
```

Provider 凭据仅由 Web API 读取。生成请求只发送人群描述和启用的业务元数据目录，不发送用户明细；生成结果仍需在页面应用并通过“保存人群”持久化。

Docker 配置创建项目专属 `cdp_lite` 数据库与账号，数据保存在 `cdp-lite_mysql-data` 卷中。初始密码在 `.env.example` 中；修改 `.env` 时也要保持数据库实际账号密码一致。环境变量优先于 `.env`。

如果使用现有 MySQL，预先创建 `utf8mb4` 数据库和具有项目库建表 / 读写权限的账号，修改 `.env` 后直接迁移。应用启动会验证数据库连接和迁移表，不会在数据库故障时切换到 Mock 或内存存储。

如果 3306 已被其他 MySQL（例如 5.7）占用，可保留现有 `.env`，使用独立的 MySQL 8.4 端口：

```bash
CDP_MYSQL_PORT=13306 DATABASE_PASSWORD=change_me docker compose up -d --wait mysql
DATABASE_PORT=13306 DATABASE_USER=cdp_lite DATABASE_PASSWORD=change_me pnpm db:migrate
DATABASE_PORT=13306 DATABASE_USER=cdp_lite DATABASE_PASSWORD=change_me pnpm db:seed
DATABASE_PORT=13306 DATABASE_USER=cdp_lite DATABASE_PASSWORD=change_me pnpm dev
```

这些覆盖只作用于当前命令，不修改原 `.env` 或其他数据库。`change_me` 仅是本地演示容器的示例密码。

演示数据包括：

- 11 个标签：会员等级、生命周期、价值与活跃分层、购买频次、优惠敏感度、品类偏好、流失风险、付费状态和 RFM 等。
- 14 个属性：年龄、性别、城市、注册渠道、设备、注册 / 活跃 / 首购 / 最近购买时间、累计消费、订单、积分和营销订阅状态等。
- 11 个行为模型：购买、浏览、页面访问、加购、搜索、登录、注册、领券、用券、退款和客服咨询；包含相应维度、枚举值和数值指标。
- “高价值数码用户”：标签 + 属性 + 行为规则的 AND 组，以及第二个 OR 组。

`db:seed` 根据稳定编码查重，不覆盖已有记录，不创建真实用户行为数据。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 并行启动前端与 API |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | 所有工作区类型检查 |
| `pnpm test` | 纯规则与编辑状态单元测试；默认跳过数据库测试 |
| `pnpm check` | ESLint、类型检查与单元测试（也是 `pre-push` 校验） |
| `pnpm build` | 共享包、API 和前端生产构建 |
| `pnpm db:migrate` | 应用版本化数据库迁移 |
| `pnpm db:seed` | 添加演示配置 |
| `pnpm auth:set-admin` | 创建或重置管理员账号（需设置 `AUTH_ADMIN_PASSWORD`） |
| `pnpm docs:api` | 从共享 Schema 重新生成 OpenAPI 文档 |
| `pnpm test:integration` | 隔离 MySQL API 集成测试 |
| `pnpm test:e2e` | 启动隔离前后端并执行 Chrome UI 验收 |

项目使用 Husky 管理 `pre-commit`、`commit-msg` 和 `pre-push`，并提供独立的服务端 `pre-receive`。安装、规则、演示和绕过方式见 [Git hooks 学习说明](docs/GIT_HOOKS.md)。

### 数据库和端到端测试

```bash
docker compose --profile test up -d --wait mysql-test
pnpm test:integration
pnpm test:e2e
```

- 测试库：`127.0.0.1:3307/cdp_lite_test`，与演示数据库完全分离。
- 测试账号：`cdp_lite`，测试密码：`change_me`；仅用于独立测试容器。
- 测试 MySQL 使用临时内存文件系统；停止容器后数据不保留。
- 端到端服务使用 `3001` 与 `5174`，由 Playwright 自动启动并关闭；需已安装 Google Chrome。
- 测试会按创建顺序反向删除自身创建的记录；不清空整库。
- Playwright 截图和失败 trace 位于 `test-results/`，HTML 报告位于 `playwright-report/`。

## API 约定

[OpenAPI 3.1](docs/openapi.yaml) 覆盖全部业务接口。

成功返回 `{ data }`，列表另含 `{ pagination: { page, pageSize, total } }`；删除返回 204。

```json
{
  "error": {
    "code": "RULE_VALIDATION_FAILED",
    "message": "规则校验未通过",
    "details": [
      { "path": "rules[0][1].aggregation.metricId", "message": "引用对象不存在或已停用，请重新选择" }
    ],
    "requestId": "请求 UUID"
  }
}
```

400 表示请求格式错误；401 表示未登录或凭据无效；404 为资源不存在或不属于父级；409 为引用、编码、不可变字段或版本冲突；422 为业务语义校验失败。

人群更新必须携带当前 `revision`，成功后递增；冲突时刷新后重新编辑。规则校验接口与正式保存复用同一个服务。

## 数据与并发策略

- 所有业务表采用 UUID 主键，UTC 存储，API ISO 8601 输出，界面按用户本地时区显示。
- 数据库列使用 snake_case；API 使用 camelCase；人群 `rules` 映射 MySQL JSON 列 `rules_json`。
- 迁移是唯一建表途径；不使用 `sequelize.sync()`。
- V1 通过事务中锁定 `system_locks` 的单个固定行，串行化所有业务写入。这样可跨 API 进程保护 JSON 引用检查、跨表编码唯一性及人群保存 / 元数据删除的竞争。
- 读请求不获取此锁。此策略适合轻量级配置应用；后续高并发可改为规范化引用表与细粒度锁。
- 未引用父级删除时，在同一个事务中删除它的子资源；被引用父级返回 409。

更多实现决策见 [开发说明](docs/IMPLEMENTATION.md)。

## 本地构建运行

```bash
pnpm build
pnpm --filter @cdp/webapi start
```

前端静态产物在 `apps/webapp/dist`，API 入口在 `apps/webapi/dist/server.js`。API 构建将共享契约打包，不依赖运行时执行工作区 TypeScript。

API 默认监听 `127.0.0.1`。生产部署还应配置 HTTPS、SPA history fallback、同源 `/api` 代理和正确的 `CORS_ORIGIN`。当前实现 `ADMIN` 与 `USER` 两级角色，尚未实现按业务资源细分的授权、密码找回、MFA 或集中身份提供商接入。

停止数据库使用 `docker compose --profile test stop`；不要使用 `down -v`，除非确实希望删除演示数据库卷。
