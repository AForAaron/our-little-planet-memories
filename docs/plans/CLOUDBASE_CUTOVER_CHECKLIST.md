# M8 切流验收清单

环境：`our-little-planet-d1dcw25f2b06ae`  
旧链路（必须保留 ≥7 天）：Vercel + Neon + R2

## 前置门禁

- [x] M0–M7 / P0–P5 全部绿灯（见 `CLOUDBASE_P{0..5}_GATE.md`）
- [x] AUTH_PROVIDER=cloudbase；STORAGE_PROVIDER=s3（长期 COS）
- [ ] 用量告警已开；未开超限自动付费（控制台人工确认）
- [x] 默认域名 Origin / Cookie / 同源写已测（020）

## 功能矩阵

- [x] 账号 A 登录会话（自动化）
- [x] 账号 B 登录会话（自动化）
- [x] 非白名单拒绝（Auth 层）
- [ ] 未验证邮箱拒绝（控制台策略已约束；未单独自动化）
- [x] 回忆列表 / 足迹 / 愿望写 / 通知 / presence（抽样自动化）
- [ ] 追评 / 贴画 revision（建议浏览器点测）
- [x] 媒体签名可读；未授权不可读
- [x] 高德 geocode 搜索
- [ ] 冷启动计时 ______ s（35 分钟观察未缩 0）
- [x] 热启动计时 ~165–284 ms
- [ ] 网络环境 / 多设备（人工）
- [x] 未登录 API 401；伪造 session 拒入
- [x] 日志无密钥泄露（抽样）
- [ ] 资源用量可接受（观察期持续看）

## 切流

- [x] 腾讯云默认域名已定为技术主入口（见 `CLOUDBASE_P6_CUTOVER.md`）
- [x] Vercel 部署保留但不作为主入口
- [x] 观察期起始日期：2026-07-30
- [x] 观察期结束（≥7 天，约 2026-08-06）前不删除 Neon / R2 / Vercel
- [ ] 双方书签/分享改到腾讯域名（产品侧待确认）

## 回滚

任一严重故障：改回 Vercel 入口；CloudBase Run 缩 0；数据以 Neon/R2 为准。
