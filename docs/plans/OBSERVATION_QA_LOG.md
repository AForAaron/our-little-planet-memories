# 观察期全类型 QA 日志（2026-07-31）

主测域名：`https://little-planet-web-289461-10-1349689007.sh.run.tcloudbase.com`  
环境：`our-little-planet-d1dcw25f2b06ae`  
分支：`codex/cloudbase-migration`（含同源 Host 修复 `e8ca830` / `a6731ff`）  
脚本：`pnpm cloudbase:observation-qa` → [`scripts/cloudbase/observation-qa.mjs`](../../scripts/cloudbase/observation-qa.mjs)  
机器结果：[`OBSERVATION_QA_RESULTS.json`](./OBSERVATION_QA_RESULTS.json)

## 阶段 0：准备与版本真实性

| 项 | 结果 | 备注 |
|----|------|------|
| 服务状态 | Pass | `tcb cloudrun list` → `little-planet-web` normal；UpdateTime 2026-07-30 23:08:27（020 切流后） |
| ImageUrl CLI 枚举 | Skip | 当前 `tcbr` Describe*Versions 系列 Action 不可用；以**同源写功能探针**代替假成功检测 |
| Health db/sharp | Pass | `db.ok` + `sharp.ok`；未登录时 `auth.hasUser=false` 导致整体 HTTP 503 属预期 |
| 双账号登录 | Pass | A/B 均 sign-in + `/home` 200 + `/api/entries` 200 |
| 未登录 API | Pass | `/api/entries` → 401 |

## 阶段 1A：写通道硬门禁（防昨天同源误杀）

全部 Pass（带 `Origin` + `Sec-Fetch-Site: same-origin` + session cookie，模拟浏览器写路径）：

| ID | 结果 |
|----|------|
| W1 A `POST /api/entries` | Pass 200 |
| W2 A `POST .../follow-ups` | Pass 200 |
| W3 A 嵌套回复（parentId） | Pass 200 |
| W4 B 发帖 + 追评 | Pass 200 |
| W5 A `PATCH /api/entries` | Pass 200 |
| W6 A `POST /api/wishlist` | Pass 200 |
| W7 A canvas sticker `POST` | Pass 201 |
| W8 A companion message | Pass 200 |
| presence / emoji-usage | Pass |
| 异站 Origin | Pass 403「请求必须从本站页面发起。」 |
| 缺失 Origin | Pass 403 |

**结论：昨天「不能提交帖子和评论」的同源误杀类故障在现网未复现。**

## 阶段 1B：媒体 / 鉴权边界 / 轮询

| 项 | 结果 | 备注 |
|----|------|------|
| M1–M3 媒体三步（presign → COS PUT → entries） | Pass | |
| M5 签名可读 | Pass | `display_url` HTTP 200 |
| M6 去签名参数 | Pass | 403 |
| 长会话 >1h 媒体过期 | Skip | 读签名默认 `expiresIn=3600`（`lib/storage/client.ts`）；本轮未静置 1h，列为观察期人工项 |
| 隐藏标签停轮询 | Code-Pass | `useVisibilityAwarePolling` 仅在 `visibilityState===visible` 且 online 时调度；需浏览器 Network 人工再确认预算 |
| 登出后写 | 抽样 | 未登录读 API 已 401；写接口同源+会话双重边界 |

## 阶段 2：展示（服务端路由）

已登录页面 HTTP 200：`/home`、`/time/timeline`、`/footprints`、`/places/map`、`/daily/wishlist`、`/notifications`、`/memories/:id`。  
读 API：notifications / presence / footprints / companion / map-points（bbox=`south,west,north,east`）/ geocode 均 200。

| 项 | 结果 |
|----|------|
| 桌面布局 / 375 窄屏目视 | Pending（需真机/浏览器） |
| 地图 ExternalMapGate 瓦片 | Pending（需浏览器点击后看瓦片） |
| 画板 spritesheet 目视 | API 贴画已通；UI 目视 Pending |

## 阶段 3：双人并发 / 一致性

| 项 | 结果 |
|----|------|
| B 可见 A 追评 | Pass |
| B 在 A 回忆上追评 | Pass（非 403） |
| B 可见 A 贴画 | Pass |
| B 可见 companion | Pass |
| presence summary | Pass |
| 画板 15s 轮询双开竞态 | Pending（需双浏览器窗口） |

## 阶段 4–5：性能与安全

### 热路径耗时（本机 → Run，已登录，各 3 次，ms）

| 路径 | 样本 |
|------|------|
| `/api/health` | 39 / 55 / 53 |
| `/home` | 114 / 215 / 98 |
| `/time/timeline` | 112 / 118 / 116 |
| `/api/entries?limit=12` | 124 / 126 / 142 |
| `/places/map` | 213 / 143 / 105 |
| `/daily/wishlist` | 100 / 88 / 88 |
| `/footprints` | 95 / 104 / 168 |

与 P5 热启动 165–284 ms 量级一致。LCP/INP/CLS 需 Chrome Performance 人工录制（见 `docs/performance-checklist.md`）。

### 本地门禁

- `pnpm typecheck` Pass
- `pnpm test` 36/36 Pass
- `pnpm test:security` 3/3 Pass

### 冷启动

仍记为「未观测到缩 0」；不填虚假秒数。

## 阶段 6：观察期运营

| 项 | 结果 |
|----|------|
| 每日冒烟脚本 | 已具备：`pnpm cloudbase:observation-qa`（含发帖+追评+媒体） |
| 双方书签改腾讯域 | Pending（产品确认） |
| 用量告警 / 禁超限付费 | Pending（控制台人工） |
| 资源用量 | 观察至 ≥2026-08-06 |

## 汇总

- **自动化/半自动：45/45 Pass**（见 JSON）
- **P0 写通道：全绿**（发帖/追评/回复/愿望/贴画/悄悄话）
- **仍待人工：** 真机窄屏、地图瓦片目视、双开画板竞态、>1h 签名过期、书签、控制台告警、冷启动数字、Chrome LCP 录制

观察期最短结束日：**2026-08-06**；期满前不删 Neon / R2 / Vercel。
