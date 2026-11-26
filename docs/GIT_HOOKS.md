# Git hooks 与 Husky 学习说明

这个项目采用“越靠近提交越快、越靠近共享仓库越完整”的分层校验。Husky 管理开发者本地的客户端 hooks；`pre-receive` 运行在接收推送的 bare 远端仓库中，因此由单独的脚本安装，不属于 Husky 的客户端生命周期。

## 四个阶段

| Hook | 触发时机 | 本项目执行内容 | 失败结果 |
| --- | --- | --- | --- |
| `pre-commit` | 创建提交前 | 检查暂存区空白、冲突标记、敏感文件、5 MiB 大文件，并仅对暂存的 JS/TS 文件运行 ESLint | 不创建提交 |
| `commit-msg` | 生成提交消息后 | commitlint 校验 Conventional Commits 和 100 字符首行上限 | 不创建提交 |
| `pre-push` | 向远端传输对象前 | 全量 ESLint、TypeScript 类型检查和单元测试 | 不开始推送 |
| `pre-receive` | 远端准备更新 refs 前 | 对所有新提交再次检查消息、空白、冲突标记、敏感文件和 5 MiB 大文件 | 整次推送被远端拒绝 |

客户端的执行链路如下：

```text
git commit                 git push
    │                          │
    ├─ pre-commit              ├─ pre-push
    │  ├─ Git 基础检查         │  ├─ ESLint
    │  └─ lint-staged          │  ├─ TypeScript
    │                          │  └─ Vitest
    └─ commit-msg              │
       └─ commitlint           └─ remote pre-receive
                                  └─ 服务端最终兜底
```

## 安装客户端 hooks

正常安装依赖即可：

```bash
pnpm install
```

安装过程中的 `prepare` 脚本会运行 Husky，并把当前仓库的 `core.hooksPath` 配置为 `.husky/_`。三个客户端 hook 的入口分别是：

- `.husky/pre-commit`
- `.husky/commit-msg`
- `.husky/pre-push`

可以手工运行对应检查，排查问题时比反复提交更方便：

```bash
pnpm check:staged
printf 'feat: add an example\n' | pnpm exec commitlint
pnpm check
```

## 提交消息约定

格式为 `<type>(<optional-scope>): <subject>`，首行最多 100 个字符。常用类型：

- `feat`：新增功能
- `fix`：修复缺陷
- `docs`：只改文档
- `refactor`：不改变外部行为的重构
- `test`：增加或调整测试
- `build` / `ci` / `chore`：构建、流水线或维护工作

示例：

```text
feat(audience): support CSV export
fix(api): reject an expired session
docs: explain local Git hooks
```

`update code`、`新增功能` 这类没有类型前缀的消息会被拒绝。这并不是 Git 自身的要求，而是团队通过 commitlint 采用的协作约定。

## 安装服务端 pre-receive

先准备一个自托管的 bare 仓库，再从本项目执行安装：

```bash
git init --bare /srv/git/cdp-lite.git
pnpm hooks:install:server -- /srv/git/cdp-lite.git
```

若目标已经有 `hooks/pre-receive`，安装器默认拒绝覆盖。应优先人工合并两个 hook；明确要覆盖时才使用 `--force`：

```bash
pnpm hooks:install:server -- /srv/git/cdp-lite.git --force
```

服务端脚本是 `scripts/git-hooks/pre-receive`。它只依赖 POSIX shell 和 Git，不要求服务器安装本项目的 Node.js 依赖。GitHub、GitLab.com 等托管平台通常不允许直接复制服务器 hook；在这些平台上应使用分支保护、Push Rules 和 CI 实现等价约束。

## 如何观察和绕过

故意使用 `git commit -m "update code"` 可以看到 `commit-msg` 拒绝信息；暂存一个含尾随空格的文件可以看到 `pre-commit` 拒绝信息。客户端 hook 可由开发者使用 `--no-verify` 跳过：

```bash
git commit --no-verify -m "chore: temporary experiment"
git push --no-verify
```

这也是服务端校验和 CI 仍然必要的原因。远端 `pre-receive` 无法被推送者用 `--no-verify` 绕过，但服务器管理员仍可修改它。Hooks 用来快速反馈和守住基础约定，不应代替代码评审、CI 或凭据扫描平台。
