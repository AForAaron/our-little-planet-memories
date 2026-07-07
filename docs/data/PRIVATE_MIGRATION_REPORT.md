# 私密目录迁移报告

迁移日期：2026-07-06

## 结果

- 原始照片：304 个文件，checksum dry-run 无差异。
- 当前微信导出：3974 个文件，checksum dry-run 无差异。
- 工作数据：checksum dry-run 无差异。
- 审核状态：迁移前后均为 1 个批准、711 个待审。
- 已批准事件：`photo-event-71944bc634d6997d`。
- 标题、摘要、状态、精选消息、精选媒体、封面、地点、隐私和备注均无差异。
- 原 `Web/Datas` 与 `Web/data-work` 已在验证完成后删除。

## ZIP SHA-256

`wechat_chat_export_wxid_rgl5jf4tb8i822_20260706_141325_402e382f2a57.zip`

```text
6d1e1043c93879997bcb3103787abcbc20c7392da246823c67c25be57fe2159a
```

`wechat_chat_export_wxid_rgl5jf4tb8i822_20260706_133839_b2054637297c.zip`

```text
7440f58b80cac40d7e4fee666cb62540ac1e64885253a0942e5e35ed2322e5c1
```

源文件与 Web-private 中对应副本的 SHA-256 分别一致。两份 ZIP 彼此的哈希不同，因此仍全部保留；内容级比较脚本为 `pnpm data:compare-zips`。

## 最终私密目录

```text
Web-private/
├── raw/
│   ├── Photos/
│   └── wechat/
│       ├── archives/
│       └── exports/current/
├── work/import/
├── publish/optimized/
└── backups/
    ├── pre-private-migration/
    └── post-private-migration/
```
