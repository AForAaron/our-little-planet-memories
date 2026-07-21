# 「我们的小星球」审计与重构计划

更新时间：2026-07-21 14:33:46 +08:00（Asia/Shanghai）

## 阶段状态

| 阶段 | 状态 | 范围 | 产物 | 备注 |
| --- | --- | --- | --- | --- |
| 01 登录故障静态诊断 | 已完成 | 登录、Neon Auth、session、allowlist、受保护路由及相关本地提交 | `audit/01-login-diagnosis.md` | 用户提供的脱敏外故障截图与静态结论一致 |
| 02 既有账号邮箱验证恢复 | 已完成，由阶段 03 修正邮件形态假设 | 未验证账号登录、重新发送验证邮件、登录页恢复 UI、纯本地 auth 测试 | `audit/02-login-verification-recovery.md` | 实际邮件提供 OTP code，不是可点击验证链接 |
| 03 邮箱 OTP 验证闭环 | 已完成，等待用户 review | OTP Server Action、6 位验证码 UI、注册后验证入口、验证码规则测试 | `audit/03-email-otp-verification.md` | 未调用真实 Neon OTP；未修改依赖与 schema |

## 当前结论

- Neon Auth 当前邮件发送 6 位 OTP code；上一阶段错误地假设邮件包含验证链接，因此仍缺少验证码提交入口。
- 已保留 allowlist + verified 双重门禁，新增 OTP 提交 Server Action、6 位数字输入 UI、过期重发和注册后验证入口。
- 下一阶段必须等待用户 review；不自动 commit、push、部署或连接线上 Neon 验证 OTP。

## 工作树说明

- 阶段开始首次检查时工作树干净。
- 执行中 `AGENTS.md` 出现非本阶段造成的删除状态；本阶段未恢复、覆盖或修改该文件。
- 阶段 03 计划内写入为 `app/login/actions.ts`、`app/login/page.tsx`、`lib/auth/verification.ts`、`tests/auth/email-verification.test.mts`、`audit/00-plan.md` 与 `audit/03-email-otp-verification.md`。
