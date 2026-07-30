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

- 热启动 `/api/health`：约 **165 ms**（5 次均值）
- 冷启动：min=0；已挂后台观察缩容后再测（见 `/tmp/cold-start-p5.log`）。若平台长时间保持 1 副本，记录为「未观测到缩 0」，不阻塞观察期，但正式宣称需补测。

## 资源

- max=1；STS COS 凭证约 2h 有效 → **控制台须换长期密钥**
- PG 外网关闭：CAM 拒绝，**控制台操作**

门禁：自动化矩阵绿灯；冷启动与长期密钥为控制台/等待项。可进 P6 文档化切流（双方改书签）。
