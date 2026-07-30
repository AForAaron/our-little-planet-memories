# P6 切流与观察期记录（2026-07-30）

## 主入口（请双方改书签/分享）

- **CloudBase Run（主）**：https://little-planet-web-289461-10-1349689007.sh.run.tcloudbase.com
- **Vercel（旁路保留，不宣传）**：https://our-little-planet-memories.vercel.app

## 观察期

- 起始：2026-07-30
- 最短结束：2026-08-06（≥7 天）
- 观察：错误率、登录、上传/媒体、冷启动、免费点额度
- **期满前不删除** Neon / R2 / Vercel；不自动关旁路

## 切流前仍须你方控制台完成

1. COS/CAM **长期密钥**写入 Run `S3_*`（替换 STS）
2. 关闭或收紧 CloudBase PG **外网**
3. 确认用量告警；禁止超限自动付费
4. 双方确认改用腾讯默认域名为主入口

## 回滚

立即改回 Vercel 入口；Run 缩 0；数据以 Neon/R2 为准。

## 状态

- 技术侧：测试域 live 全链路可用；现网 Vercel 配置未改
- 产品侧：主入口切换依赖双方确认（本文件即通知清单）
