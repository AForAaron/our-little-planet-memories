# P0 基线冻结记录（2026-07-30）

- 环境 ID：`our-little-planet-d1dcw25f2b06ae`
- Git SHA：`bc3bda462281a735a69637cdea3157f9e2d5477f`（分支 `codex/cloudbase-migration`）
- Run 服务：`little-planet-web`
- 公网域名：`https://little-planet-web-289461-10-1349689007.sh.run.tcloudbase.com`
- 健康检查：`/api/health` → `ok:true`，`mode:demo`
- Neon 快照目录：`Web-private/backups/neon-snapshots/2026-07-30T11-38-25-880Z`
- Neon 计数：profiles=2 entries=46 media=235 chat_messages=4149 entry_canvas_items=83 auth_identity_map=0
- CloudBase：schema 已存在；业务表示意行数应为 0（见同次探测）
- 告警：请在控制台「日志监控 / 计费」确认用量提醒已开；禁止超限自动付费
- 现网：Vercel 未切流；迁移窗口内尽量少写入 Neon

门禁：P0 通过 → 进入 P1。
