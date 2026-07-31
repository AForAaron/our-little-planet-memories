# M8 切流验收清单

环境：`our-little-planet-d1dcw25f2b06ae`  
旧链路（必须保留 ≥7 天）：Vercel + Neon + R2  
最近代理复检：2026-07-31（见 `OBSERVATION_QA_LOG.md`，70/70）

## 前置门禁

- [x] M0–M7 / P0–P5 全部绿灯（见 `CLOUDBASE_P{0..5}_GATE.md`）
- [x] AUTH_PROVIDER=cloudbase；STORAGE_PROVIDER=s3（长期 COS）
- [x] 超限开关：`DescribeBillingInfo.EnableOverrun=false`（代理 API 核实）；告警规则 UI 细项 CLI 不可达已记 Skip
- [x] 默认域名 Origin / Cookie / 同源写已测（020）；2026-07-31 扩展写矩阵全绿

## 功能矩阵

- [x] 账号 A 登录会话（自动化）
- [x] 账号 B 登录会话（自动化）
- [x] 非白名单拒绝（Auth 层）
- [x] 未验证邮箱：CloudBase 路径依赖控制台开通映射账号（代理无法另造未验证用户；现网双账号均可登录）
- [x] 回忆列表 / 足迹 / 愿望写 / 通知 / presence（含 PATCH/DELETE 扩展）
- [x] 追评 / 贴画 revision（含 409 冲突与恢复）
- [x] 媒体签名可读；未授权不可读；TTL=3600；篡改签名拒绝
- [x] 高德 geocode + 瓦片抽样
- [x] 冷启动：记「未观测到缩 0」（不填虚假秒数）
- [x] 热启动 / 热路径：约 57–182 ms（2026-07-31 本机）
- [x] 多设备书签：Skip（代理不可读设备书签；技术主入口仍为腾讯默认域）
- [x] 未登录 API 401；伪造 session 拒写
- [x] 日志/响应无密钥泄露（抽样）
- [x] 资源套餐 NORMAL / 体验版；超限关闭；用量告警规则 UI Skip

## 切流

- [x] 腾讯云默认域名已定为技术主入口（见 `CLOUDBASE_P6_CUTOVER.md`）
- [x] Vercel 部署保留但不作为主入口
- [x] 观察期起始日期：2026-07-30
- [x] 观察期结束（≥7 天，约 2026-08-06）前不删除 Neon / R2 / Vercel
- [x] 书签切换：Skip（代理不可达）；技术侧主入口已定为腾讯域

## 回滚

任一严重故障：改回 Vercel 入口；CloudBase Run 缩 0；数据以 Neon/R2 为准。
