# P2 门禁记录（2026-07-30）

- 线上流量版本：`little-planet-web-008`（007 已 normal；008 当前 flow=100）
- Run Env：`APP_DATA_MODE=live`、`AUTH_PROVIDER=cloudbase`、`CLOUDBASE_AUTH_ENABLED=1`、内网 DB `172.17.0.4`、`ALLOWLIST_EMAILS` 已配
- `/api/health` → `mode:live`；`/api/health?db=1` → `db.ok`，`profilesCount:2`
- Auth：控制台 EMAIL 登录已开；双白名单账号可 `signin`；`/user/me` 正常
- `auth_identity_map`：2 行，UID→既有 Neon `profiles.id`（未改写 UUID）
- 验收：`scripts/cloudbase/accept-p2-auth.mjs` → ok；测试域带 `planet_cloudbase_session` 访问 `/home` 双账号 200；无 cookie → 307 `/login`；交叉密码/非白名单拒绝
- 现网 Vercel 仍为 Neon Auth，**未切流**

门禁：P2 通过 → 进入 P3。
