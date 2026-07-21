# 登录故障静态诊断报告

- 生成时间：2026-07-21 11:43:33 +08:00（Asia/Shanghai）
- 阶段：01 登录故障静态诊断
- 扫描范围：`app/login/`、`app/register/`、`app/api/auth/`、`app/(protected)/layout.tsx`、`lib/auth/`、`lib/config/backend.ts`、`proxy.ts`、认证 schema introspection、相关文档、依赖锁定信息及本地 Git 历史。
- 修改范围：未修改业务源码、配置、依赖、schema 或 Git 状态；仅写入本报告与 `audit/00-plan.md`。
- 扫描方法：入口枚举、逐行控制流审阅、最近提交前后 diff、`git blame`、认证 schema 字段核对、无写入 TypeScript 检查。

## 实际执行的命令

以下命令均在仓库内执行；扫描显式避开 `.env.local`、`.git/`、`.next/`、`node_modules/` 内容、私密 roots 和仓库外数据：

```text
pwd
git status --short --branch
sed -n '1,260p' AGENTS.md
sed -n '1,240p' package.json
rg --files ... | rg '(middleware|proxy|auth|login|sign-in|signin|callback|session|layout|page|route|next.config|vercel|README|tests)'
rg -l ... '(NeonAuth|authClient|signIn|signOut|getSession|allowlist|AUTH_|/login|/api/auth)'
nl -ba app/login/actions.ts
nl -ba app/login/page.tsx
nl -ba app/register/page.tsx
nl -ba 'app/api/auth/[...path]/route.ts'
nl -ba lib/auth/server.ts
nl -ba lib/auth/profile.ts
nl -ba proxy.ts
nl -ba 'app/(protected)/layout.tsx'
nl -ba app/page.tsx
nl -ba lib/config/backend.ts
nl -ba next.config.ts
git log --date=iso-strict --format=... -25 -- <认证相关路径>
git show --stat --oneline --decorate --summary d642a00
git diff --no-ext-diff --unified=80 d642a00^ d642a00 -- <认证相关路径>
git show d642a00^:<认证文件>
rg -n ... '(APP_DATA_MODE|NEON_AUTH|ALLOWLIST_EMAILS|登录|邮箱验证|Vercel|deploy)' README.md docs audit
rg -n ... '(@neondatabase/auth|next@|react@)' pnpm-lock.yaml
rg -n ... '(emailVerified|email_verified|verification)' drizzle-auth-introspection drizzle lib app tests
git show -s --date=iso-strict --format=... HEAD
git rev-parse HEAD
git rev-parse origin/main
git blame -L 35,49 -- lib/auth/server.ts
git blame -L 35,45 -- app/login/actions.ts
pnpm exec tsc --noEmit --incremental false --pretty false
node_modules/.bin/tsc --noEmit --incremental false --pretty false
```

`pnpm exec tsc` 未完成：pnpm 在检查本地依赖状态时尝试访问 registry 并准备重装依赖，网络访问失败且目录移除因非交互模式中止。本阶段没有批准网络或依赖变更，因此没有重试或绕过。随后确认仓库已有本地 `tsc` binary，直接运行同等无写入检查并通过。

## 未覆盖部分及原因

- 未读取 `.env.local` 或任何运行时环境变量值，因此没有确认线上 `APP_DATA_MODE`、Neon Auth URL、Cookie Secret 或 allowlist 的实际配置。
- 未连接 Neon Auth/Postgres、Vercel 或生产站，因此没有确认两个账号当前的 `emailVerified` 值、认证服务响应、部署日志或生产 cookie。
- 未启动 `dev`、`build`、`start` 或浏览器，也未执行登录请求；这些动作会越过本阶段静态审计红线。
- 仓库没有 auth 测试，本阶段也没有新增测试或安装工具。
- 因缺少运行态证据，本报告能确认代码触发条件，但“当前线上事故就是该条件”只能标为高置信度疑似，不能写成已经证实的线上事实。

## 结论摘要

当前最强根因候选是 2026-07-20 17:24:57 +08:00 的提交 `d642a00`。该提交在密码认证成功后新增 `emailVerified === true` 检查，并在每次读取 session 时重复执行同一检查。提交前只要求邮箱位于 allowlist；提交后，已有账号只要未完成邮箱验证，就会从“可以登录”立即变成“密码正确但仍被拒绝”。

这与“之前能登录、现在又不能登录”的时间和行为高度吻合。静态证据不能证明线上账号字段当前为 `false`，所以最终确认只需要做一个最小运行态核验：在 Neon Auth 的用户管理界面查看两个白名单账号是否均处于已验证状态，不要读取或回显任何密钥。

## Findings

[确认] [严重度: 高] [认证门禁变化] `app/login/actions.ts:35-45`、`lib/auth/server.ts:37-49` | 密码认证成功后，代码要求 `data.user.emailVerified === true`；受保护页面又对 session user 重复相同要求 | 任何已有账号的字段为 `false`、`null` 或响应中缺失该字段 | 密码正确也会被拒绝或返回登录页，两个旧账号可能同时失去访问能力 | 保留验证门禁，先通过 Neon Auth 支持的验证流程让两个既有 allowlist 账号完成验证；随后增加未验证账号的恢复入口和回归测试 | 运行态恢复不改仓库；代码防复发涉及 `app/login/actions.ts`、登录 UI 和新增 auth 测试，需另开修复阶段验证

[疑似] [严重度: 高] [当前事故根因] `app/login/actions.ts:41-43`、`README.md:41-42` | 新门禁与文档要求在同一安全提交中加入，旧版本没有这一要求 | 生产部署包含 `d642a00`，且既有账号是在启用邮件验证前创建或从未点击验证链接 | 部署后立即表现为“又不能登录” | 在 Neon Auth 管理界面只核对账号验证状态；若未验证，重新发送并完成验证后复测；不要直接修改 Neon 管理的 auth schema | 用户侧一次最小状态核验；无需依赖或 schema 变更

[确认] [严重度: 中] [错误可观测性] `app/login/actions.ts:35-44`、`lib/auth/profile.ts:14-31` | Neon 登录错误被统一折叠成“邮箱或密码错误”，而登录后的 profile 查询/写入异常没有本地分类处理 | Neon Auth URL/服务异常、凭据错误、cookie 未写入或 Postgres/profile 初始化异常 | 不同根因在 UI 上表现相近，无法仅凭当前提示快速区分 | 在不输出邮箱、token、cookie、连接串的前提下，为登录阶段记录脱敏错误类别与 request id，并给 UI 使用稳定错误码；profile 初始化失败应与凭据失败分开 | 修改 2–3 个认证文件并增加 mock 测试；不需要 schema 变更

[确认] [严重度: 中] [回归测试缺口] `package.json:5-15`、`app/login/actions.ts:20-45`、`lib/auth/server.ts:33-63` | 当前唯一测试脚本只覆盖 internal-path；不存在登录、allowlist、邮箱验证或 session guard 回归测试 | 后续安全加固再次改变认证判定条件 | 合法的两个账号可能在部署后同时被锁在站外，而静态 typecheck 仍会通过 | 为 `emailVerified=true/false/null`、allowlist 命中/未命中和已认证 session 增加本地 mock 测试，并在部署前执行 | 新增 auth 测试文件及必要的纯函数抽取；无需连接真实 Neon

## 故障症状与最短处理路径

| 用户可见现象 | 代码分支 | 当前判断 | 最短处理 |
| --- | --- | --- | --- |
| 页面提示需要先完成邮箱验证 | `app/login/actions.ts:41-43` | 与本次新增门禁直接吻合 | 在 Neon Auth 支持的验证流程中完成两个既有账号的邮件验证，再重新登录 |
| 页面提示邮箱不在访客名单 | `app/login/actions.ts:25-30` | allowlist 当前值或邮箱规范化问题 | 仅人工核对部署平台中变量名称、条目数量和目标邮箱；不要输出值 |
| 页面提示 Neon Auth 未配置 | `app/login/actions.ts:31-33`、`lib/config/backend.ts:11-17` | 必需变量缺失或 Cookie Secret 长度不足 | 在部署平台逐项确认变量“存在且作用于当前环境”，不要读取或复制值 |
| 页面只提示邮箱或密码错误 | `app/login/actions.ts:35-36` | 可能是凭据，也可能是被折叠的 provider 错误 | 查看脱敏服务端错误类别；当前代码不足以继续静态区分 |
| 提交后返回登录页，没有明确错误 | `lib/auth/server.ts:43-49`、`app/(protected)/layout.tsx:11-17` | session cookie 缺失，或 session user 未通过 verified/allowlist | 先核对 `emailVerified`；若为 true，再检查响应是否设置 session cookie和后续请求是否携带，但不要回显 cookie 内容 |
| 出现 500 | `app/login/actions.ts:44`、`lib/auth/profile.ts:14-31` | profile 初始化或数据库访问异常 | 查看脱敏服务器日志，确认失败阶段；不要执行 migration 或修改 schema，除非另行获得批准 |

## 推荐解决方案

### 立即恢复（推荐，保持安全门禁）

1. 在 Neon Auth 的用户管理界面查看两个 allowlist 账号的邮箱验证状态；只看状态，不导出用户数据。
2. 对未验证账号使用 Neon Auth 支持的邮件验证/重新发送流程，完成验证。
3. 重新登录。若仍失败，按上表记录“页面具体提示或 HTTP 状态”，不要提供邮箱、密码、cookie 或链接。
4. 若两个账号均已验证但仍被退回登录页，再进入 cookie/session 专项诊断；此时需要用户另行授权允许的运行态观测范围。

### 防止复发的代码修复阶段

1. 保留 `emailVerified === true` 和 allowlist 双重门禁。
2. 为未验证但凭据正确的账号提供明确、限流的重新验证入口；实现前先静态确认当前 Neon Auth SDK 支持的 API，不引入新依赖。
3. 将 provider、verification、session cookie、profile 初始化失败映射为不同的稳定错误码；日志只记录阶段和 request id。
4. 增加纯本地 auth 回归测试，覆盖 verified/unverified、allowlist 和 session guard。

不推荐直接删除 `emailVerified` 检查：这会恢复旧账号访问，但同时撤销刚加入的私密访问安全边界。

## 需要用户做价值判断的项

- 是否继续坚持“allowlist + 已验证邮箱”双重门禁。对这个仅供两人使用且包含最高敏感数据的网站，本报告建议保留。
- 是否授权下一阶段实施“重新验证入口 + 脱敏错误分类 + auth 回归测试”。本阶段没有自动修改源码。

## 验证结果

- `node_modules/.bin/tsc --noEmit --incremental false --pretty false`：通过，退出码 0。
- `pnpm exec tsc --noEmit --incremental false --pretty false`：未执行到 TypeScript 检查；pnpm 试图访问 registry/重装依赖后失败，未获准重试。
- Git：扫描时 `HEAD` 与本地 `origin/main` 均为 `4d42b4ad209399131567a3291f0d72b0dcb50c5a`，认证安全提交 `d642a00` 已在当前历史中。
- 运行态登录：未执行，原因见“未覆盖部分”。

## 工作树漂移

首次阶段前检查为干净工作树；执行中 `AGENTS.md` 出现删除状态。该变化不是本阶段产生，本阶段没有恢复或覆盖它。最终 diff 复核时应将其与本阶段新增的两个 `audit/` 文件区分。
