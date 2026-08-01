# P5 门禁记录（2026-07-30）

版本：`little-planet-web-020`（live + cloudbase Auth + 内网 PG + S3/COS 长期密钥 + AMAP；含同源 Host 修复）

## 功能矩阵（测试域名自动化）

| 项 | 结果 |
|----|------|
| 双账号 session → `/home` | 200 |
| `/api/entries` 已登录 | 200（有数据） |
| `/api/notifications` `/api/presence` `/api/footprints` | 200 |
| `/api/map-points?bbox=` | 200 |
| `/api/geocode/search`（高德） | 200 |
| 未登录 `/api/entries` | 401；未登录 `/home` | 307→/login |
| `/api/wishlist` GET | 405（路由仅 POST/PATCH/DELETE，预期） |
| `/api/wishlist` POST（同源写） | 200（020 起；旧镜像会 403） |
| `/api/presence` POST | 200 |
| COS 签名 GET | 200；未授权公网 GET | 403 |
| 日志/响应无连接串回显 | 通过（health/db 无密钥） |

## 启动

- 热启动 `/api/health`：约 **165–284 ms**
- 冷启动：观察约 **35 分钟**未缩 0（`saw_zero=false`）；不阻塞观察期

## 资源

- max=1；长期 COS 密钥（无 `S3_SESSION_TOKEN`）
- PG 外网已关

门禁：自动化矩阵绿灯（含同源写）；冷启动记为「未观测到缩 0」。可进 P6。
