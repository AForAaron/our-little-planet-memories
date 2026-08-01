# P1 门禁记录（2026-07-30）

- 服务版本：`little-planet-web-005`（仓库分支 `codex/cloudbase-migration`，SHA `4ea68ea`）
- 环境变量（控制台，无密钥入仓）：`APP_DATA_MODE=demo`、`DATABASE_DRIVER=node-postgres`、`DATABASE_URL`→内网 `172.17.0.4:5432`、`PGSSL=disable`、`PGPOOL_MAX=3`
- 服务配置：`MaxNum=1`；`VpcConf`=`vpc-jsfwv6y4` / `subnet-7uzy243b`
- 公网 `/api/health` → `ok:true`，`mode:demo`
- `/api/health?db=1` → `db.ok:true`，`driver:node-postgres`，`profilesCount:0`（无连接串回显）
- `/api/health?sharp=1` → `sharp.ok:true`
- 现网 Vercel 未改；仍为 demo，未开 live Auth

门禁：P1 通过 → 进入 P2。
