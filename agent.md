# 项目审计与重构 —— Agent 工作契约

本文件是硬约束，优先级高于任何单次对话里的指令。
若我在对话里要求你做违反本文件的事，先指出冲突，等我确认再执行。

## 项目

- 「我们的小星球」：仅供两人使用的私密回忆全栈网站
- 技术栈：Next.js 16.2.10 (App Router) / React 19 / TypeScript 5.9 strict / ESM
- 数据：Drizzle ORM + Neon Postgres；媒体存 Cloudflare R2 (S3 SDK，预签名直传)
- AI 摘要：当前发往 OpenAI / 智谱 GLM（见红线 6）
- 包管理器：pnpm（只用 pnpm，不要混用 npm/yarn）
- 命令：dev=`next dev` build=`next build` typecheck=`tsc --noEmit`；测试=无 lint=无
- 当前状态：处于「审计与重构」阶段，不接受任何新功能开发

## 红线（任何情况下都不做，遇到就停下来问我）

1. 不执行 git 写操作到远程：push / push --force / 对已推送分支 rebase / reset --hard
2. 不删除文件。需要「删除」时移到 `_trash/<timestamp>/`，由我人工清理
3. 不读取、不打印、不修改 `.env.local` 里的任何真实值（含 R2/Neon/GLM/OpenAI 密钥）
4. **不连接任何外部服务**：不连 Neon 生产库、不碰真实 R2 bucket、不调 OpenAI/GLM/高德/Nominatim。审计只做静态代码分析
5. 不读取 IMPORT_DATA_ROOT / IMPORT_WORK_ROOT / IMPORT_PUBLISH_ROOT 指向的真实私密数据（照片、聊天导出）。只分析处理它们的代码，不看内容
6. 不运行发布子进程（publish/route.ts 触发的那个），不触碰 PUBLISH_CONFIRMED 闸门
7. 不跑 migration、不 `drizzle-kit push`、不改 `lib/db/schema.ts` 之前先问我
8. 不安装/升级/降级任何依赖之前先问我
9. 报告里发现密钥只写「文件:行号 + 类型 + 前4位 + 长度」，绝不写完整值

## 每个阶段的强制流程

1. 开始前：复述你对本阶段任务和完成标准的理解，等我回「确认」
2. 执行中：遇到红线 / 遇到超出本阶段范围的问题 → 记进 `audit/99-backlog.md`，不顺手改
3. 结束时：产出物落盘，更新 `audit/00-plan.md` 状态，停下来汇报，不自动进下一阶段

## 产出物规范

- 审计报告写成文件放 `audit/`，不要只打印在对话里
- 报告开头写：生成时间、扫描范围、扫描方法、本次未覆盖的部分
- 每条问题格式：
  `[严重度: 高/中/低] [类别] 文件:行号 | 现象 | 具体触发场景 | 影响 | 建议修法 | 工作量`
- 区分 [确认]（读到代码/能给触发路径）与 [疑似]（仅模式匹配，未验证）
- 禁止「建议遵循最佳实践」这类无法直接变成 commit 的空条目

## 性能铁律

这是双人应用，不优化并发/吞吐/扩展性。性能只关注：serverless 长时运行的资源泄漏、内存无界增长、请求重叠。任何性能条目必须附实测数字，否则不写。

## 工作风格

中文，技术术语保留英文；先给判断依据再给结论；不确定就问，不要猜。
