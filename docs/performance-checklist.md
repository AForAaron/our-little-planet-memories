# 线上性能验收清单

只以已登录的生产站结果验收；`pnpm dev` 的首次编译时间不计入用户体验指标。

## 录制方式

1. 使用 Chrome 无痕窗口登录生产站，分别做一次冷缓存和热缓存录制。
2. DevTools Network 勾选 Preserve log，Performance 同时录制页面加载与一次实际交互。
3. 每条路径连续跑三次，保存 HAR、Performance trace 和 Network Summary。

## 必测路径

- `/home`：首次进入、最近回忆封面出现。
- `/time/timeline`：首屏、加载更多、编辑和删除。
- 任一分类列表：分页与跨分类编辑。
- 有多张媒体和聊天记录的 `/memories/:id`。
- `/footprints`：筛选与加载更多。
- `/places/map`：首次地图、缩放和 marker 聚合。
- 新建回忆：图片上传、缩略图生成、保存后跳转详情。

## 记录指标与预算

| 指标 | 目标 |
| --- | --- |
| LCP p75 | 不高于 2.5 秒 |
| INP p75 | 不高于 200 毫秒 |
| CLS | 不高于 0.1 |
| 收起小窗、前台 30 秒后台请求 | 不超过 2 次 presence + 1 次通知 |
| 后台标签页/离线 | 0 次轮询请求 |
| 时间轴首屏 | 至多 24 条，列表图片为缩略图 |

同时标注 HTML/RSC TTFB、最大图片字节数、长任务、Neon 查询时长和 R2 下载时长。若某项超过预算，先在 Network/Performance 中确认它属于数据、媒体、JS 主线程还是地图瓦片，再决定后续优化，不用主观体感替代证据。

## 发布前检查

```bash
pnpm typecheck
pnpm build
pnpm data:thumbnails:dry-run -- --limit 20
```

缩略图回填必须先 dry-run；确认目标对象后，再分批执行 `pnpm data:thumbnails:backfill -- --limit 20 --delay-ms 150`。先在 Vercel Preview 用真实登录态复测，再发布生产。
