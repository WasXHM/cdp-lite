# CDP Lite 技术架构与工程实现规范

**文档性质：** 工程架构与开发实施基线  
**适用范围：** CDP Lite 第一阶段（元数据管理、人群构建）  
**配套文档：** `CDP_Lite_PRD.md`  
**原则：** PRD 定义业务行为，本规范定义技术实现；冲突时先澄清业务语义，不擅自更改 PRD。

## 1. 目标与边界

建设可运行、可维护、可演示的前后端分离 Web 应用：支持标签、属性、行为模型（维度、指标和枚举值）的 CRUD，以及标签/属性/行为混合的人群规则编辑、校验、保存和回显。规则组内 AND、组间 OR，持久化二维数组。第一阶段不实现数据采集、标签加工、人群真实计算、成员明细和分发；任何页面不得伪称真实计算结果。

### 1.1 架构决策

- **架构形态：** pnpm Workspace Monorepo；单体 Koa API + 独立 React SPA；一个 MySQL 实例。禁止为 V1 引入微服务、Kafka、Redis 或计算引擎。
- **后端：** Node.js 当前维护中的 LTS 版本、Koa2、TypeScript（ESM `import/export`）、Sequelize（选用与当前 Node/MySQL 兼容的稳定版）、MySQL 8.x。
- **前端：** React + TypeScript + Vite、React Router、Ant Design、TanStack Query、Zustand（仅限确需跨组件共享的编辑器状态）、React Hook Form + Zod（或项目统一选择同等方案，不混用多套表单框架）。
- **实时能力：** 保留 Socket.IO 接入位置，但 V1 不要求实际业务 WebSocket；避免空转连接。REST 是唯一的业务写入入口。
- **接口：** REST JSON，`/api/v1` 统一前缀；OpenAPI 3.1 契约；统一错误结构和分页。
- **验证：** Zod 等运行时校验；API 输入和人群规则在服务端必须再次校验，不能信任前端。
- **配置：** 环境变量；不将凭据提交到 Git。生产配置和本地配置分离。

## 2. 系统分层

```text
Browser / React SPA
  ├── Pages / Feature components / Rule Builder
  ├── Query & API Client / Form State
  └── Typed DTOs
             │ HTTPS REST /api/v1
             ▼
Koa HTTP Layer
  ├── Router / Auth placeholder / Validation / Error handler
  ├── Controller (HTTP adapter)
  ├── Service (business rules / transactions / reference checks)
  ├── Repository (query abstraction)
  └── Sequelize Models / Migrations
             │
             ▼
           MySQL 8
```

**依赖方向：** Controller → Service → Repository → Sequelize Model。Controller 不直接操作 Model；Service 不依赖 Koa `ctx`；Repository 不承担业务决策。跨模块业务操作通过 Service 协作。所有数据库事务由 Service 控制并向 Repository 传入 transaction。

### 2.1 后端职责

| 层 | 负责 | 不负责 |
|---|---|---|
| Router | 路由声明、中间件绑定 | 业务判断 |
| Controller | 解析请求、调用服务、转换 HTTP 响应 | SQL、复杂规则校验 |
| Service | 业务校验、引用完整性、事务、状态转换 | HTTP 细节 |
| Repository | 条件查询、分页、持久化 | 业务状态机 |
| Model | 表结构映射、关联定义 | API 响应结构 |
| Schema/DTO | 请求校验、输出契约、规则判别联合 | 数据库操作 |

## 3. 仓库与目录规范

```text
cdp-lite/
├── apps/
│   ├── webapp/
│   │   ├── package.json
│   │   └── src/
│   │       ├── app/                 # Router、Provider、应用初始化
│   │       ├── pages/               # 路由级页面
│   │       ├── features/
│   │       │   ├── metadata/        # 标签、属性、枚举
│   │       │   ├── events/          # 行为模型、维度、指标
│   │       │   └── audiences/       # 人群、规则编辑器
│   │       ├── components/          # 跨业务共享 UI
│   │       ├── hooks/
│   │       ├── lib/                 # API client、格式化、通用函数
│   │       ├── styles/
│   │       └── main.tsx
│   └── webapi/
│       ├── package.json
│       └── src/
│           ├── app.ts              # Koa app 创建（不监听端口）
│           ├── server.ts           # 启动入口
│           ├── config/
│           ├── middleware/
│           ├── routes/
│           ├── controllers/
│           ├── services/
│           ├── repositories/
│           ├── models/             # 每表一个文件：Metadata.ts 等
│           ├── migrations/
│           ├── schemas/
│           ├── errors/
│           └── socket/             # 预留入口
├── packages/
│   └── contracts/                  # 前后端共享 DTO、枚举和规则 Schema
├── docs/
│   ├── PRD.md
│   ├── architecture.md
│   └── openapi.yaml
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .env.example
└── README.md
```

**硬性约束：** 应用源代码均置于各自 `src/` 下，与 `package.json` 同级；Sequelize 每张表一个 Model 文件，例如 `src/models/Metadata.ts`。所有后端业务代码使用 ES Module；不得混入 CommonJS `require`。共享包不得依赖前后端框架或数据库实体。

## 4. 领域模型与数据库设计

### 4.1 核心表

| 表 | 关键字段 | 说明 |
|---|---|---|
| `metadata` | `id`, `metadata_type`, `name`, `field_name`, `data_type`, `display_type`, `is_enum`, `description`, `status`, timestamps | TAG / ATTRIBUTE 共表；唯一键 (`metadata_type`,`field_name`) |
| `metadata_enum_values` | `id`, `metadata_id`, `label`, `value`, `sort_order`, `status` | 唯一键 (`metadata_id`,`value`) |
| `event_models` | `id`, `name`, `event_code`, `description`, `status`, timestamps | `event_code` 唯一 |
| `event_dimensions` | `id`, `event_model_id`, `name`, `field_name`, `data_type`, `display_type`, `is_enum`, `status` | 隶属于行为模型 |
| `event_dimension_values` | `id`, `dimension_id`, `label`, `value`, `sort_order`, `status` | 唯一键 (`dimension_id`,`value`) |
| `event_metrics` | `id`, `event_model_id`, `name`, `field_name`, `data_type`, `description`, `status` | V1 指标限定数值型 |
| `audiences` | `id`, `name`, `audience_code`, `description`, `rules_json`, `schema_version`, `status`, timestamps | `audience_code` 唯一；`rules_json` MySQL JSON |

所有表采用一致的主键策略（建议 UUID 字符串或 BIGINT，选定后不得混用），统一 UTC 存储时间、API 使用 ISO 8601，前端按用户时区显示。字符集 `utf8mb4`。关联字段建索引和外键；涉及软删除时需明确唯一性策略，V1 建议“引用中的元数据仅可停用，不物理删除”。

维度和指标的 `field_name` 不得在同一行为模型内冲突：此约束涉及两张表，由 Service 事务内校验；仅依靠各自的唯一索引不足以保证跨表唯一。数据库迁移是唯一正式建表渠道，禁止生产环境使用 `sequelize.sync({ alter: true })`。

### 4.2 规则领域模型

`AudienceRules = AudienceRule[][]`。第一维各组之间 OR，第二维组内各条规则 AND；数组顺序用于界面回显，不影响布尔语义。`AudienceRule` 是按 `metadataType` 判别的联合类型：`TAG | ATTRIBUTE | EVENT`。

```ts
export type Scalar = string | number | boolean;
export type RuleValue = Scalar | Scalar[] | [Scalar, Scalar] | null;
export type Operator =
  | 'EQ' | 'NE' | 'GT' | 'GTE' | 'LT' | 'LTE'
  | 'IN' | 'NOT_IN' | 'BETWEEN'
  | 'CONTAINS' | 'NOT_CONTAINS' | 'IS_NULL' | 'IS_NOT_NULL';

export type SimpleRule = {
  metadataType: 'TAG' | 'ATTRIBUTE';
  metadataId: string;
  operator: Operator;
  value: RuleValue;
};

export type DimensionFilter = {
  dimensionId: string;
  operator: Operator;
  value: RuleValue;
};

export type EventRule = {
  metadataType: 'EVENT';
  eventId: string;
  timeRange:
    | { type: 'RELATIVE'; unit: 'DAY'; value: number }
    | { type: 'ABSOLUTE'; start: string; end: string };
  dimensionFilters: DimensionFilter[];
  aggregation: {
    type: 'COUNT' | 'SUM' | 'AVG' | 'MAX' | 'MIN';
    metricId: string | null;
  };
  operator: 'EQ' | 'NE' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'BETWEEN';
  value: number | [number, number];
};

export type AudienceRule = SimpleRule | EventRule;
export type AudienceRules = AudienceRule[][];
```

**行为规则顺序：** 先选 `EVENT` → 选择 `eventId` → 设置必填 `timeRange` → 选择该模型下维度（可多条，内部 AND）→ 选择 COUNT 或该模型下的数值指标聚合 → 比较值。维度过滤先于指标聚合。COUNT 必须 `metricId: null`，其他聚合必须有有效 `metricId`。同一组的两个行为规则独立判定，不表示同一条事件同时满足两条规则。

**操作符与值的对应：** `IS_NULL` / `IS_NOT_NULL` 使用 `null`；`IN` / `NOT_IN` 为非空数组；`BETWEEN` 为长度 2 且下界不大于上界的数组；其余操作符按元数据类型使用单值。枚举必须检查值编码归属。日期比较使用 ISO 格式并按数据类型区分日期和日期时间。`CONTAINS` 不应被误解释为枚举多选，枚举多选使用 `IN`。

**规则引用策略：** JSON 存稳定 ID，显示名称由元数据查询回填，不把显示名作为判断依据。编辑时若元数据已停用或缺失，原规则保留并显示错误；不允许无提示自动删除或替换。规则结构版本字段初始为 `1`，V1 不实现版本迁移功能。

## 5. REST API 设计

### 5.1 通用约定

- 基础路径 `/api/v1`；资源名称复数、kebab-case；HTTP 方法表达操作。
- 成功单对象：`{ "data": { ... } }`；列表：`{ "data": [...], "pagination": { "page": 1, "pageSize": 20, "total": 100 } }`。
- 错误：`{ "error": { "code": "RULE_VALIDATION_FAILED", "message": "规则不合法", "details": [{ "path": "rules[0][1].value", "message": "不能为空" }], "requestId": "..." } }`。
- 状态码：200 查询/修改；201 创建；204 删除；400 格式错误；404 不存在；409 引用冲突/唯一性冲突；422 业务校验失败；500 未预期错误。
- 查询参数：`page`（从 1 开始）、`pageSize`（默认 20，最大 100）、`keyword`、`status`；排序仅允许白名单字段。
- 更新统一 `PATCH` 部分更新；禁止通过 `PATCH` 隐式修改不可变技术编码及数据类型。
- 列表默认不返回大型枚举集合或完整人群规则；详情接口返回完整结构。

### 5.2 元数据接口

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/metadata?type=TAG` | 标签列表；`type=ATTRIBUTE` 为属性 |
| POST | `/metadata` | 创建标签/属性 |
| GET | `/metadata/:id` | 元数据详情 |
| PATCH | `/metadata/:id` | 更新基础信息/状态 |
| DELETE | `/metadata/:id` | 删除未被引用元数据 |
| GET | `/metadata/:id/enum-values` | 枚举值列表 |
| POST | `/metadata/:id/enum-values` | 新增枚举值 |
| PATCH | `/metadata/:id/enum-values/:valueId` | 修改枚举值 |
| DELETE | `/metadata/:id/enum-values/:valueId` | 删除未被引用枚举值 |

### 5.3 行为模型接口

| 方法 | 路径 | 用途 |
|---|---|---|
| GET/POST | `/event-models` | 列表/创建 |
| GET/PATCH/DELETE | `/event-models/:id` | 详情/修改/删除 |
| GET/POST | `/event-models/:id/dimensions` | 维度列表/创建 |
| PATCH/DELETE | `/event-models/:id/dimensions/:dimensionId` | 维度修改/删除 |
| GET/POST | `/event-models/:id/dimensions/:dimensionId/values` | 维度枚举值列表/创建 |
| PATCH/DELETE | `/event-models/:id/dimensions/:dimensionId/values/:valueId` | 维度值修改/删除 |
| GET/POST | `/event-models/:id/metrics` | 指标列表/创建 |
| PATCH/DELETE | `/event-models/:id/metrics/:metricId` | 指标修改/删除 |

行为模型详情可以嵌套返回维度和指标以支持编辑页一次加载；嵌套写入仅在显式定义事务语义后提供，V1 默认使用各资源独立 API。所有子资源接口均验证父级归属，不允许跨模型操作。

### 5.4 人群接口

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/audiences` | 人群列表，不含完整规则 |
| POST | `/audiences` | 创建人群及规则 |
| GET | `/audiences/:id` | 人群详情，含 `rules` |
| PATCH | `/audiences/:id` | 修改人群及规则 |
| DELETE | `/audiences/:id` | 删除人群 |
| POST | `/audiences/:id/copy` | 复制人群，生成新 ID 和唯一编码 |
| POST | `/audiences/validate-rules` | 规则预校验，不持久化 |

`POST /audiences` 请求示例：

```json
{
  "name": "高价值数码用户",
  "audienceCode": "high_value_digital",
  "description": "演示人群",
  "status": "CONFIGURED",
  "rules": [
    [
      { "metadataType": "TAG", "metadataId": "tag-member-level-id", "operator": "EQ", "value": "GOLD" },
      {
        "metadataType": "EVENT",
        "eventId": "event-purchase-id",
        "timeRange": { "type": "RELATIVE", "unit": "DAY", "value": 30 },
        "dimensionFilters": [
          { "dimensionId": "dim-category-id", "operator": "EQ", "value": "DIGITAL" }
        ],
        "aggregation": { "type": "SUM", "metricId": "metric-amount-id" },
        "operator": "GT",
        "value": 1000
      }
    ]
  ]
}
```

`rules` 是 API 字段；`rules_json` 是数据库字段，不暴露数据库列名。`status=CONFIGURED` 仅表示规则有效并已保存，不代表计算完成。预校验与正式保存调用同一套规则校验服务，防止逻辑分叉。

### 5.5 读取规则编辑器选项

可复用现有资源列表和详情接口。为避免编辑器多次请求，可选提供 `GET /rule-catalog?type=TAG|ATTRIBUTE|EVENT` 返回启用的可选对象基础信息；选定行为模型后再通过 `GET /event-models/:id` 获取其维度/指标。**不要**在选择行为模型前加载所有模型的所有维度和指标。

## 6. 人群规则服务实现

### 6.1 前后端共享校验

`packages/contracts` 定义枚举、DTO 和结构校验 Schema；后端 Service 另外执行数据库语义校验：元数据存在、启用状态、枚举值归属、维度/指标归属、数据类型兼容、被引用资源删除限制。共享代码不直接查询数据库。

### 6.2 编辑器状态流

1. 点击“新增条件”，必须先选择 `TAG` / `ATTRIBUTE` / `EVENT`。
2. 标签/属性：选择元数据 → 按数据类型过滤操作符 → 按展示类型和操作符渲染输入组件。
3. 行为：选择行为模型 → 配置时间 → 加载当前模型的维度/指标 → 维度过滤 → 聚合指标 → 比较值。
4. 切换规则类型时清空原条件的所有不兼容字段；切换行为模型时清空维度和聚合配置，时间范围可以保留。
5. 删除规则/规则组后仍须满足非空规则组约束；未完成的条件允许在编辑态暂存，但禁止作为有效人群保存。
6. 保存时先客户端校验，再提交后端完整校验；失败时根据 `details.path` 将错误定位到具体规则。
7. 编辑已有规则时必须做到加载 → 修改 → 保存 → 重新加载语义不变。

### 6.3 并发与事务

- 创建人群和复制人群使用数据库事务；复制操作必须生成新的 `audienceCode`，若冲突返回 409 或按确定性策略重试。
- 规则保存与元数据停用/删除的引用检查存在并发竞态。V1 应在事务内使用一致的锁定顺序或采用保守的禁止删除策略；不能仅靠前端禁用删除按钮。
- `audiences` 建议使用乐观并发字段 `revision`（初始 1），更新时校验客户端版本，冲突返回 409，防止两个浏览器互相覆盖规则。

## 7. React 前端工程规范

### 7.1 路由

```text
/metadata/tags
/metadata/tags/new
/metadata/tags/:id/edit
/metadata/attributes
/metadata/attributes/new
/metadata/attributes/:id/edit
/metadata/events
/metadata/events/new
/metadata/events/:id/edit
/audiences
/audiences/new
/audiences/:id/edit
```

### 7.2 组件组织

```text
features/audiences/
├── api/                  # audienceApi.ts, audienceQueries.ts
├── components/
│   ├── AudienceForm.tsx
│   ├── RuleBuilder.tsx
│   ├── RuleGroup.tsx
│   ├── RuleItem.tsx
│   ├── RuleTypeSelector.tsx
│   ├── SimpleRuleEditor.tsx
│   ├── EventRuleEditor.tsx
│   ├── EventTimeRangeField.tsx
│   ├── DimensionFilterList.tsx
│   ├── AggregationEditor.tsx
│   └── RuleValueInput.tsx
├── hooks/                # useRuleCatalog.ts 等
├── model/                # 编辑器状态、纯函数操作
└── utils/                # 规则转换、显示文案
```

`metadata` 模块共用 `MetadataForm`、`EnumValueTable`；`events` 模块独立封装 `DimensionEditor`、`MetricEditor`、`DimensionValueEditor`。跨模块共享组件放 `src/components`，业务专属组件不提前抽象为通用组件。

### 7.3 状态边界

- TanStack Query：服务端数据缓存、加载、失效与重新请求。
- 表单库：单页基础表单状态、字段错误。
- React 局部 state：弹窗开关、折叠、当前选中项。
- Zustand：仅当规则编辑器多个深层组件需要共享草稿状态时使用；不可复制一份与 Query 长期并行的服务器数据。
- 规则编辑器修改必须通过纯函数，如 `addGroup`、`addRule`、`changeRuleType`、`changeEventModel`、`removeRule`；禁止直接修改原数组。

### 7.4 组件交互约束

- `RuleBuilder` 只管理二维数组和组间关系；`RuleGroup` 只管理组内条件及 AND 展示。
- `RuleItem` 按判别字段选择 `SimpleRuleEditor` 或 `EventRuleEditor`，不包含所有业务细节。
- `EventRuleEditor` 的维度/指标选项严格从选中模型派生；异步切换模型时必须防止旧请求结果覆盖新模型选项（查询 key 包含 `eventId`）。
- 操作符和数据类型映射集中维护；不能散落于组件中的多处条件判断。
- 枚举值展示 label、保存 code；未识别或停用值需保留原值并明确标记，不得静默替换。
- 所有删除动作二次确认；离开有未保存更改的编辑页需提示；提交时防重复点击。

## 8. 后端中间件与安全基线

Koa 中间件顺序建议：请求 ID → 错误处理 → 安全响应头 → CORS（仅允许配置的来源）→ Body Parser（限制 JSON 大小）→ 请求日志 → 鉴权占位 → Router → 404。服务端校验所有输入并限制分页、字符串长度、数组深度/数量；禁止客户端传任意 SQL 字段名作为排序条件。Sequelize 查询优先参数化 API，避免拼接原始 SQL。日志不记录密码、凭据或完整敏感业务数据。

V1 可以采用单一演示管理员模式，但必须显式声明为本地/受控环境，不得把无鉴权服务直接暴露公网。未来引入用户登录时，Controller/Service 通过统一的身份上下文接入，而非各业务自行读取 token。

## 9. 测试与验收

| 层次 | 工具建议 | 核心场景 |
|---|---|---|
| 单元测试 | Vitest | 操作符映射、规则编辑纯函数、值类型校验 |
| 服务测试 | Vitest + HTTP 测试工具 | Koa API 状态码、错误结构、归属校验 |
| 数据集成测试 | 独立 MySQL 测试库 | 迁移、唯一索引、事务、引用保护 |
| 端到端 | Playwright | 元数据创建 → 行为维度/指标配置 → 混合圈人 → 保存 → 回显 |

最低验收用例：

1. 创建字符串枚举标签和属性，并管理枚举值。
2. 创建行为模型，添加两个维度和两个数值指标；配置枚举维度值。
3. 在同一个 AND 组中添加标签、属性、行为规则；新增第二个 OR 组。
4. 行为规则先选择模型和时间范围，再配置其所属维度、指标与聚合。
5. 切换模型后旧维度和指标被清空，不会提交跨模型 ID。
6. 非法操作符、空值、错误枚举编码、无效时间范围均被服务端拒绝。
7. 人群保存后重新加载，规则结构和语义保持一致。
8. 被人群引用的元数据、维度、指标和枚举值不能被直接物理删除。
9. 复制人群生成独立记录，不影响原人群。
10. 所有演示功能均不依赖真实用户行为数据或计算引擎。

## 10. 本地开发与部署

### 10.1 命令约定

```bash
pnpm install
pnpm dev           # 并行启动 webapp / webapi
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:migrate
pnpm db:seed        # 可选：演示数据
```

具体脚本应在根 `package.json` 中统一实现。`webapp` 通过 Vite proxy 将 `/api` 转发到 Koa；生产环境通过反向代理提供 SPA 静态资源和 API，禁止在浏览器中硬编码数据库地址。

### 10.2 环境变量示例

```dotenv
NODE_ENV=development
WEB_PORT=5173
API_PORT=3000
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_NAME=cdp_lite
DATABASE_USER=cdp_lite
DATABASE_PASSWORD=change_me
CORS_ORIGIN=http://localhost:5173
```

`.env.example` 仅存示例；`.env` 纳入 `.gitignore`。应用启动时验证环境变量，数据库不可用应明确报错而非静默运行。

## 11. 建议开发顺序

| 阶段 | 交付 |
|---|---|
| 1. 工程基座 | Workspace、Koa、React、MySQL 连接、迁移、API 统一响应、页面布局 |
| 2. 标签与属性 | 元数据 CRUD、枚举值管理、表单校验 |
| 3. 行为模型 | 模型 CRUD、维度、指标、维度值管理、父子归属约束 |
| 4. 规则领域 | 共享类型、操作符、规则校验、规则 JSON、服务端引用校验 |
| 5. 人群构建器 | 混合规则、行为模型选择、时间范围、维度和指标、AND/OR 组 |
| 6. 人群管理 | 列表、创建、编辑、复制、删除、规则回显 |
| 7. 收尾验收 | 自动化测试、种子数据、README、API 文档、构建部署 |

每阶段必须完成可运行的前后端闭环，不以静态 UI 或 Mock 接口代替已要求的数据库持久化功能。

## 12. Codex 初始化执行约束

1. 先阅读 `docs/PRD.md` 与 `docs/architecture.md`，按二者实现 V1，不自行扩展计算、人群分发或 AI 功能。
2. 创建 pnpm Workspace，按本规范生成 `apps/webapi`、`apps/webapp`、`packages/contracts`。
3. 所有业务源代码置于各应用 `src/`；后端使用 Koa2、Sequelize、MySQL、ESM；每表一个 Sequelize Model 文件。
4. 先实现数据库迁移和 REST API，再构建页面；接口返回真实持久化数据。
5. 人群规则必须使用二维数组；组内 AND、组间 OR；新增规则先选 TAG/ATTRIBUTE/EVENT。
6. 行为规则必须先选行为模型及时间范围，再选该模型下的维度和指标；禁止跨模型引用。
7. 每完成一个阶段执行 lint、typecheck、测试并修复失败项；更新 README 和 OpenAPI。
8. 遇到 PRD 未明确的业务决策，记录待确认事项，不以实现便利为由擅自改变规则语义。

---

**最终交付标准：** 本地安装依赖、配置 MySQL、执行迁移和启动命令后，可通过浏览器完成元数据配置与混合人群规则的完整创建、保存、回显、编辑流程；后端数据真实持久化，且无需任何 CDP 计算基础设施。
