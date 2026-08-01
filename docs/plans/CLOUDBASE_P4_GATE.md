# P4 门禁记录（2026-07-30）

- 私有桶：`little-planet-media-private-1349689007`（上海 COS）
- DB 引用对象数：282；目标侧已存在（migrate apply → skipped=282）；抽样 5 个对象 R2/COS `ContentLength` 一致
- 未登录公网 GET → **403**（私有）
- R2 保留未删
- Run：`STORAGE_PROVIDER=s3` + `S3_*`；**2026-07-30 晚**：控制台已换成长期 COS 密钥，线上 `little-planet-web-014` **无** `S3_SESSION_TOKEN`
- 现网 Vercel/R2 未切流

门禁：对象、权限、长期密钥均通过。
