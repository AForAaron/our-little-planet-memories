# 「我们的小星球」审计与重构计划

更新时间：2026-07-21 13:07:58 +08:00（Asia/Shanghai）

## 阶段状态

| 阶段 | 状态 | 范围 | 产物 | 备注 |
| --- | --- | --- | --- | --- |
| 01 登录故障静态诊断 | 已完成 | 登录、Neon Auth、session、allowlist、受保护路由及相关本地提交 | `audit/01-login-diagnosis.md` | 用户提供的脱敏外故障截图与静态结论一致 |
| 02 既有账号邮箱验证恢复 | 已完成，等待用户 review | 未验证账号登录、重新发送验证邮件、登录页恢复 UI、纯本地 auth 测试 | `audit/02-login-verification-recovery.md` | 未访问 Neon 或发送真实邮件；未修改依赖与 schema |

## 当前结论

- 登录故障由“既有账号未验证，但界面没有验证恢复入口”形成闭环：登录被 verified 门禁拒绝，重复注册又被 Auth 拒绝。
- 已保留 allowlist + verified 双重门禁，并新增白名单邮箱重新发送验证邮件的 Server Action 与恢复 UI。
- 下一阶段必须等待用户 review；不自动 commit、push、部署或连接线上 Neon 验证邮件投递。

## 工作树说明

- 阶段开始首次检查时工作树干净。
- 执行中 `AGENTS.md` 出现非本阶段造成的删除状态；本阶段未恢复、覆盖或修改该文件。
- 阶段 02 计划内写入为认证恢复相关源码、`tests/auth/email-verification.test.mts`、`audit/00-plan.md` 与 `audit/02-login-verification-recovery.md`。
