# 既有账号邮箱验证恢复修复报告

- 生成时间：2026-07-21 13:07:58 +08:00（Asia/Shanghai）
- 阶段：02 既有账号邮箱验证恢复
- 扫描与修改范围：`app/login/actions.ts`、`app/login/page.tsx`、`lib/auth/server.ts`、新增 `lib/auth/verification.ts` 与 `tests/auth/email-verification.test.mts`，以及本审计产物。
- 扫描方法：用户故障截图的脱敏行为核对、Server Action 控制流审阅、Neon Auth SDK TypeScript 接口验证、纯本地 `node:test`、无写入 TypeScript 检查和 Git diff 复核。
- 实际执行的主要命令：`git status --short --branch`、`rg --files tests ...`、`rg -n ... '(sendVerification|emailVerified)'`、`nl -ba <认证文件>`、`node_modules/.bin/tsc --noEmit --incremental false --pretty false`、`node --experimental-default-type=module --test tests/auth/email-verification.test.mts tests/security/internal-path.test.mts`、`git diff --check`、`git diff --stat`、`git status --short --branch`；文本修改使用 `apply_patch`。
- 明确未覆盖：没有读取 `.env.local`，没有连接 Neon Auth/Postgres，没有发送真实验证邮件，没有点击真实验证链接，没有启动 `dev`/`build`/`start`，也没有访问部署日志。原因是这些动作会越过当前静态审计红线。

## 修复结论

[确认] [严重度: 高] [认证恢复缺失] `app/login/actions.ts:45-53`、`app/login/page.tsx:90-105` | 已注册但未验证的白名单账号能通过密码认证，却被 `emailVerified` 门禁退回登录页；原界面只有注册入口 | 账号已存在且 `emailVerified !== true` | 用户在“不能登录”和“不能重复注册”之间循环 | 保留 verified 门禁，转入不含邮箱的恢复状态，并提供白名单邮箱重新发送验证邮件的 Server Action | 已修改登录 action/UI，新增纯函数与本地测试；真实邮件投递需部署后人工验收

[确认] [严重度: 中] [错误引导] `app/login/actions.ts:95-98`、`app/login/page.tsx:129-140` | 注册失败原先直接显示 provider message，既有账号没有明确返回恢复流程 | 用户误把“需要验证”理解为“需要重新注册” | 重复提交注册，仍无法进入网站 | 注册失败改为稳定的中文恢复提示；登录页常驻“已经注册但没有收到验证邮件”入口 | 已完成；无需依赖或 schema 变更

[确认] [严重度: 中] [输入与门禁一致性] `lib/auth/verification.ts:1-13`、`app/login/actions.ts:65-80` | 登录、注册和重新发送需要使用相同的邮箱规范化与 verified 判定 | 邮箱包含大小写或首尾空格，或 verified 字段为 false/null/缺失 | allowlist 比对不一致或误放行 | 抽取无副作用的邮箱规范化和 verified 判定函数，并仅允许 allowlist 中的地址触发重新发送 | 已新增 2 个本地测试，覆盖大小写、空白及 verified 的全部分支

## 实现结果

- 未验证账号使用正确密码登录后跳转到 `/login?verification=required`；URL 不包含邮箱或其他敏感信息。
- 登录页明确提示“账号已经存在，无需重新注册”，并提供“重新发送验证邮件”表单。
- Server Action 先检查 live/Neon 配置，再规范化邮箱并执行 allowlist 校验，然后调用现有 Neon Auth SDK 的 `sendVerificationEmail`；未新增依赖。
- 验证邮件 callback 返回 `/login?verified=1`，页面提示使用原密码登录。
- 发送失败仍保留恢复表单，不会把用户再次送回注册流程。
- `emailVerified === true` 与 allowlist 双重门禁保持不变。

## 验证结果

- `node_modules/.bin/tsc --noEmit --incremental false --pretty false`：通过，退出码 0。
- 新增 auth 测试：2/2 通过。
- 既有 security 测试：3/3 通过。
- 合并执行：5/5 通过，无失败、跳过或取消。
- `git diff --check`：通过。
- 未执行真实邮件投递与 callback：需要部署环境中的 Neon Auth 邮件配置，当前阶段禁止联网。

## 需要用户做价值判断的项

- 是否接受当前方案继续保留“allowlist + 已验证邮箱”双重门禁。本修复按更安全的保留方案实现，没有退回只检查 allowlist。
- 部署后是否由用户使用一个白名单账号执行一次“重新发送 → 点击验证链接 → 原密码登录”的最小验收；验收时不要提供邮箱、验证链接、cookie 或 token。

## 工作树说明

- 阶段开始时仅存在非本阶段造成的 `AGENTS.md` 删除状态。
- 本阶段没有恢复、覆盖、stage、commit 或删除该文件。
- 未修改 `.env.local`、依赖文件、lockfile、数据库 schema、migration 或 introspection。
