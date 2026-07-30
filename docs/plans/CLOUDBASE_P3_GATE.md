# P3 门禁记录（2026-07-30）

- 相对 P0 基线有漂移（接受当前快照，未做正式冻结窗口）：entries 46→47，media 235→236，notifications/events/follow_ups/emoji 等亦有增加
- 导出：`Web-private/backups/neon-snapshots/2026-07-30T13-33-53-121Z`（`--with-data`）
- 导入 CloudBase：业务表计数对齐（profiles=2 entries=47 media=236 chat_messages=4149 canvas=83 …）；`tencentdb_*` 未动
- 导入后重跑 `seed-auth-identity.mjs`（Neon 快照 `auth_identity_map=0` 会清空映射）；`accept-p2-auth` 再绿
- 抽样：entries 标题可读
- Run `/api/health?db=1` 仍通；Neon 源未 truncate
- **外网 PG**：`postgres:CloseDBExtranetAccess` 返回 CAM 无权限；需你在控制台关闭/收紧外网。Run 已走内网 `172.17.0.4`

门禁：数据导入通过；外网关闭待控制台。进入 P4（不阻塞，因 Run 已内网）。
