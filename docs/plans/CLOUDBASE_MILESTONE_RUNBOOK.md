# CloudBase 大陆迁移里程碑操作手册

源码分支：`codex/cloudbase-migration`  
CloudBase 环境：`our-little-planet-d1dcw25f2b06ae`（上海 PostgreSQL）  
禁止：对 `rui-ledger-*`（瑞记）执行任何写入或复用凭据。

## 当前执行进度（代码侧，2026-07-30）

| 里程碑 | 状态 | 说明 |
|--------|------|------|
| M0 | 代码/核验完成 | PG17 已确认；本机 `tcb` 仍登录瑞记，部署前必须换第二账号 |
| M1 | 完成 | `standalone` 构建通过；`/api/health` 与 `?sharp=1` 探活通过；Docker 守护进程未就绪，镜像待本机构建 |
| M2 | 代码完成，CloudBase 空库待连接串 | `DATABASE_DRIVER` + `pg` 已接入；`0009_auth_identity_map` 已在 Neon 验证可迁移；**尚未**对 CloudBase 空库执行 |
| M3 | 阻塞 | 需第二账号 `tcb login` + Docker/镜像推送 + 控制台创建 Run |
| M4 | 脚手架完成 | `auth_identity_map` + `AUTH_PROVIDER`；CloudBase 会话解析待控制台开通后接线 |
| M5 | 导出完成 / 导入阻塞 | Neon 只读计数已导出至 `Web-private/backups/neon-snapshots/`；导入需 CloudBase `DATABASE_URL` |
| M6 | 适配器完成 / 复制阻塞 | `STORAGE_PROVIDER=r2\|s3`；对象复制脚本已就绪，需 S3_* 目标桶 |
| M7 | 完成 | 正式页瓦片与默认地理编码改为高德 |
| M8 | 清单就绪 | 见 `CLOUDBASE_CUTOVER_CHECKLIST.md`；未切流 |

### Neon 只读基线（勿当 CloudBase 已迁完）

- profiles 2 / entries 46 / media 235 / chat_messages 4149 / entry_canvas_items 83
- `auth_identity_map` 表已存在，行数 0

## M0 核验记录（2026-07-30）

- Git HEAD 基线：`3deb3ce47ff2e2d79365dff2c1c3b20355ed71f1`（建分支前）
- `.env*` 已被 `.gitignore` 忽略；`Web-private` 在源码目录外
- 控制台已确认 PostgreSQL 17.10，实例 `postgres-mclllbze`，`public` 存在系统探测表（勿删）
- 官方文档支持 PostgreSQL 协议直连（云托管用 `pg` 连接池）
- 本机 `tcb` 当前登录的是瑞记环境；部署小星球前必须 `tcb logout` 后用第二账号 `tcb login`，再 `-e our-little-planet-d1dcw25f2b06ae`

### 你需要补充的连接信息（打码反馈）

在控制台「SQL 型数据库 → 连接信息」确认后填写（勿把密码写入本文件或 Git）：

- 内网主机：有 / 无
- 公网主机：有 / 无
- 端口：
- 是否要求 SSL：
- 库名（通常 `postgres`）：

## M1 容器化

见仓库根目录 `Dockerfile`、`.dockerignore`，健康检查 `GET /api/health`。

本地验收：

```bash
pnpm build
docker build -t our-little-planet:local .
docker run --rm -p 3000:3000 -e APP_DATA_MODE=demo our-little-planet:local
curl -sS http://127.0.0.1:3000/api/health
curl -sS http://127.0.0.1:3000/api/health?sharp=1
```

## M2 空库 schema

```bash
# .env.cloudbase.local（勿提交）示例：
# DATABASE_DRIVER=node-postgres
# DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/postgres?sslmode=require

export $(grep -v '^#' .env.cloudbase.local | xargs)
pnpm db:migrate
pnpm exec tsx scripts/cloudbase/probe-db.ts
```

## M3 CloudBase Run

前提：第二账号已 `tcb login`，且本地镜像可推送。

```bash
tcb cloudrun -h
# 使用控制台创建服务亦可：min=0 max=1 port=3000 health=/api/health
# APP_DATA_MODE=demo 先冒烟，再逐步挂 DATABASE_*
```

记录冷启动、热启动秒数与资源点消耗；设用量告警，禁止超限自动付费。

## M4 Auth 映射

- 表：`auth_identity_map`（migration `0009`）
- `AUTH_PROVIDER=neon|cloudbase`（默认 neon，保证现网可回滚）
- CloudBase 控制台开通邮箱登录后，将 UID 写入映射，禁止覆盖 `profiles.id`

## M5 数据迁移

```bash
pnpm data:export-neon-snapshot   # 只读 Neon
pnpm data:import-cloudbase-snapshot --dry-run
# 确认后去掉 --dry-run；失败可清空业务表重跑，勿动 tencentdb_* 探测表
```

## M6 媒体

- `STORAGE_PROVIDER=r2|s3`（CloudBase/COS 兼容 S3 时用 `s3` + 对应 endpoint）
- 仅迁移 DB 已引用对象；禁止上传 `Web-private/raw`

## M7 地图

正式页瓦片与搜索默认高德；OSM/CARTO 不再作为正式自动请求路径。

## M8 切流

见同目录 `CLOUDBASE_CUTOVER_CHECKLIST.md`。观察期 ≥7 天内保留 Vercel/Neon/R2。
