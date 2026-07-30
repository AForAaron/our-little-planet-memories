# P5 门禁记录（2026-07-30）

版本：`little-planet-web-011`（live + cloudbase Auth + 内网 PG + S3/COS + AMAP）

## 功能矩阵（测试域名自动化）

| 项 | 结果 |
|----|------|
| 双账号 session → `/home` | 200 |
| `/api/entries` 已登录 | 200（有数据） |
| `/api/notifications` `/api/presence` `/api/footprints` | 200 |
| `/api/map-points?bbox=` | 200 |
| `/api/geocode/search`（高德） | 200（补 `AMAP_WEB_SERVICE_KEY` 后） |
| 未登录 `/api/entries` | 401；未登录 `/home` | 307→/login |
| `/api/wishlist` GET | 405（路由仅 POST/PATCH/DELETE，预期） |
| COS 对象未授权公网 GET | 403 |
| 日志/响应无连接串回显 | 通过（health/db 无密钥） |

## 启动

- 热启动 `/api/health`：约 **165 ms**（5 次均值）；补测约 **276 ms**（单次）
- 冷启动：后台观察约 **35 分钟**，`CurrentReplicas` 始终为 **1**，**未观测到缩 0**（`saw_zero=false`）；到期探针仍为热路径（200 / ~276 ms）。不阻塞观察期；若需正式冷启动数字，须另择空闲窗口或临时调 min 后再测。

## 资源

- max=1；长期 COS 密钥已上（见 P4）
- PG 外网已关

门禁：自动化矩阵绿灯；冷启动记为「未观测到缩 0」。可进 P6 文档化切流（双方改书签）。
