# P3 门禁记录（2026-07-30）

- 快照：`Web-private/backups/neon-snapshots/2026-07-30T12-44-50-078Z`（`--with-data`）
- 相对 P0 漂移：entries 46→47，media 235→236；导入后 Neon 再计数与快照一致（无二次增量必要）
- 导入：修复 `import-cloudbase-snapshot.mjs` 外键顺序（`entry_canvas_items` 先于 `activity_notifications`）；业务表计数对齐；抽样回忆标题/愿望/聊天 4149/贴画 83 正常
- `auth_identity_map`：Neon 导出为 0；导入后重跑 `seed-auth-identity.mjs` → CloudBase 侧 2 行映射
- 误操作纠正：曾把 cloudbase 映射写入 Neon，已从 Neon 删除 `provider=cloudbase` 行（Neon Auth 不依赖该表）
- PG 外网：CLI 无可用「关闭外网」接口（体验版/CAM）；**请在控制台收紧/关闭 PostgreSQL 外网**；Run 已用内网 `172.17.0.4`
- 现网 Vercel/Neon 业务数据未 truncate；未切流

门禁：P3 数据对齐通过 → 进入 P4（控制台关外网为人工待办，不阻断媒体迁移但须尽快完成）。
