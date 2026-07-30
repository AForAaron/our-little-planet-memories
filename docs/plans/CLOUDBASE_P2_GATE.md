# P2 门禁记录（2026-07-30）

- 控制台：`EMAIL` 登录已 ENABLE；体验版无法加自定义 Auth 安全域 → 采用服务端 Auth HTTP + httpOnly cookie
- 代码：`lib/auth/cloudbase.ts` / `cloudbase-shared.ts`；登录 actions / proxy 已接 `AUTH_PROVIDER=cloudbase`
- Git：`20b298b`（分支 `codex/cloudbase-migration`）
- Run 版本：`little-planet-web-007` flow=100；`APP_DATA_MODE=live`、`AUTH_PROVIDER=cloudbase`、`CLOUDBASE_AUTH_ENABLED=1`、内网 DB、ALLOWLIST、暂用 R2
- 映射：双 UID → 既有 Neon `profiles.id`（`auth_identity_map` 2 行）；未改写 `profiles.id`
- 探活：`/api/health` mode=live；`?db=1` profilesCount=2
- 验收：本机 `accept-p2-auth.mjs` 双账号登录/错密/非白名单拒绝 + 映射覆盖；测试域名 cookie 会话访问 `/home` 双账号 200，坏 token 不可进受保护页；未登录 `/home` → `/login`
- 现网 Vercel：仍 Neon Auth，未切流

门禁：P2 通过 → 进入 P3（导入后须重跑 identity seed，因 truncate 会清 map）。
