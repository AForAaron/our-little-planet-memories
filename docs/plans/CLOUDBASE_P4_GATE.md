# P4 门禁记录（2026-07-30）

- 私有桶：`little-planet-media-private-1349689007`（ap-shanghai COS）；ACL 仅所有者 FULL_CONTROL
- 说明：CloudBase 默认文件存储因 PG 环境无法改安全规则（只读公开），故**另建私有 COS 桶**
- 迁移：`migrate-media-objects.mjs` dry-run/apply；DB 引用对象 **282** 全部复制；未触碰 `Web-private/raw`；R2 保留
- 抽样：5 个对象与 R2 `ContentLength` 一致；公网直链 HEAD **403**；签名 URL **GET 200**（COS 对 HEAD 可能 403，属平台差异）
- Run：已切 `STORAGE_PROVIDER=s3` + `S3_*`（当前为 `tcb secrets` **临时密钥**，有过期时间）；**控制台须尽快创建长期 SecretId/SecretKey 并替换 Run 环境变量**，否则观察期会断媒体
- 回滚：Run 改回 `STORAGE_PROVIDER=r2` + 原 R2_*

门禁：对象对齐 + 未授权不可读通过；长期密钥为人工待办（不阻断 P5 短窗验收）。
