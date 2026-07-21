# 邮箱 OTP 验证闭环修复报告

- 生成时间：2026-07-21 14:33:46 +08:00（Asia/Shanghai）
- 阶段：03 邮箱 OTP 验证闭环
- 扫描与修改范围：`app/login/actions.ts`、`app/login/page.tsx`、`lib/auth/verification.ts`、`tests/auth/email-verification.test.mts`、`audit/00-plan.md` 与本报告。
- 扫描方法：用户提供的邮件/页面截图脱敏核对、Server Action 控制流审阅、TypeScript 顶层 SDK key 探测与参数检查、纯本地 `node:test`、Git diff 复核。
- 实际执行的主要命令：`git status --short --branch`、`rg -n ... '(emailOtp|verifyEmail|otp)'`、`nl -ba <认证文件>`、`node_modules/.bin/tsc --noEmit --incremental false --pretty false`、`node --experimental-default-type=module --test tests/auth/email-verification.test.mts tests/security/internal-path.test.mts`、`git diff --check`、`git diff --stat`；文本修改使用 `apply_patch`。
- 明确未覆盖：没有读取 `.env.local`，没有调用真实 Neon Auth，没有提交用户收到的验证码，没有启动应用或访问部署日志。截图中的邮箱与验证码未写入源码、测试或报告。

## 修复结论

[确认] [严重度: 高] [验证流程断裂] `app/login/page.tsx:79-142`、`app/login/actions.ts:79-122` | Neon Auth 实际发送 6 位 OTP code，阶段 02 页面却只提示点击邮件完成验证，没有验证码输入或提交动作 | 用户收到 code 而非链接 | 用户拥有有效验证码仍无法把账号标记为已验证 | 将恢复流程改为“发送 OTP → 输入邮箱与 6 位 code → Neon emailOtp verifyEmail → 返回密码登录” | 已修改 3 个认证文件并扩展本地测试；真实 OTP 调用需部署后验收

[确认] [严重度: 中] [注册后错误入口] `app/login/actions.ts:125-141`、`app/login/page.tsx:79-86` | 注册成功原先进入仅含说明的登录页 | 新账号收到 OTP 邮件 | 新账号也找不到输入位置 | 注册成功直接进入 OTP 输入状态，并明确 code 有效期与后续密码登录步骤 | 已完成，无依赖或 schema 变更

[确认] [严重度: 中] [验证码输入约束] `lib/auth/verification.ts:9-12`、`app/login/page.tsx:117-138` | 原流程没有 OTP 的服务端格式校验或浏览器输入约束 | 空值、非数字、位数错误或复制时携带空格 | 无效请求进入 Auth provider，错误提示不稳定 | 服务端仅接受规范化后的 6 位 ASCII 数字；输入框使用 numeric keyboard、one-time-code autocomplete、pattern 与 maxLength | 新增 1 组测试，覆盖有效、过短、过长、非数字与空值

## 实现结果

- 重新发送成功后进入 `/login?verification=code`；URL 不包含邮箱或 OTP。
- 验证页面只显示“邮箱 + 6 位验证码”表单，不与密码登录表单叠加。
- OTP Server Action 先检查 live/Neon 配置、邮箱 allowlist 和 code 格式，再调用 `emailOtp.verifyEmail({ email, otp })`。
- 当前 Neon server wrapper 的顶层类型确认包含 `emailOtp`，但插件方法被声明为 `unknown`；源码使用最小本地接口收窄，真实方法调用仍列为部署后验收项。
- 验证错误、过期和 provider 异常均返回稳定提示，且保留验证码表单。
- 验证成功后返回登录页，要求使用原密码重新建立 session。
- 验证码页面允许返回密码登录或回到重新发送步骤；页面允许纵向滚动，避免小屏裁切。

## 验证结果

- `node_modules/.bin/tsc --noEmit --incremental false --pretty false`：通过，退出码 0。
- Auth 规则测试：3/3 通过。
- 既有 security 测试：3/3 通过。
- 合并执行：6/6 通过，无失败、跳过或取消。
- `git diff --check`：通过。
- 真实 OTP：未执行；需要部署后使用一枚新验证码验收，过期截图验证码不应复用。

## 需要用户做价值判断的项

- 是否接受当前 OTP 方案继续保留“allowlist + 已验证邮箱”双重门禁。本修复没有降低认证要求。
- 部署后是否由用户执行一次“重新发送 → 输入新 code → 原密码登录”的最小验收；不要把邮箱、code、cookie 或 token 发送回审计记录。

## 工作树说明

- 阶段开始时仅存在非本阶段造成的 `AGENTS.md` 删除状态。
- 本阶段没有恢复、覆盖、stage、commit 或删除该文件。
- 未修改 `.env.local`、依赖、lockfile、数据库 schema、migration 或 introspection。
