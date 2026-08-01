# 观察期全量 QA 日志（代理执行 · 2026-07-31 第二轮）

主测域名：`https://little-planet-web-289461-10-1349689007.sh.run.tcloudbase.com`  
环境：`our-little-planet-d1dcw25f2b06ae` · 服务 `little-planet-web` normal（UpdateTime 2026-07-31 09:54:54）  
脚本：`pnpm cloudbase:observation-qa` → [`scripts/cloudbase/observation-qa.mjs`](../../scripts/cloudbase/observation-qa.mjs)  
机器结果：[`OBSERVATION_QA_RESULTS.json`](./OBSERVATION_QA_RESULTS.json)

**结论：70/70 Pass（含 3 项代理不可达 Skip，不计入失败）。写通道无同源误杀；测后已清理全部 `obs-qa-*` 回忆，首页无测试标题污染。**

---

## 阶段 0：现状

| 项 | 结果 | 备注 |
|----|------|------|
| CloudRun 服务 | Pass | normal / PUBLIC |
| Health db/sharp | Pass | 未登录时 auth.hasUser=false → HTTP 503 属预期 |
| 残留 obs-qa 开跑前 | Pass | 0 条 |
| 双账号登录 | Pass | A/B `/home` + entries GET 200 |

---

## 阶段 1A：写通道硬门禁 + 补全同源写

| ID | 结果 |
|----|------|
| W1–W5 发帖/追评/回复/B 发帖/编辑 | Pass |
| W6 / W6b / W6c 愿望 POST/PATCH/DELETE | Pass |
| W7–W7e 贴画 POST/PATCH、B 旧 revision→409、恢复 PATCH、DELETE | Pass |
| W8 companion | Pass |
| presence / emoji / footprints POST | Pass |
| notifications PATCH | Pass |
| inbox PATCH | Pass |
| uploads presign DELETE | Pass |
| settings 空标题 → 400（未改生产标题） | Pass |
| 异站 Origin / 缺 Origin → 403 | Pass |
| 无效 session 写 → 401 | Pass |

---

## 阶段 1B：媒体与签名

| 项 | 结果 |
|----|------|
| M1–M3 三步上传入库 | Pass |
| M5 签名可读 / M6 去签 403 | Pass |
| M7 `X-Amz-Expires=3600` | Pass（不空等 1h） |
| M8 篡改 Signature → 403 | Pass |

---

## 阶段 2：展示（代理 HTML 断言，非人工目视）

| 项 | 结果 |
|----|------|
| `/home` `/time/timeline` `/wishlist` `/footprints` `/places/map` `/notifications` 含中文关键文案、无乱码替换符 | Pass |
| 详情页 HTML | Pass |
| 高德瓦片抽样 `image/png` 200 | Pass |
| map-points / geocode | Pass |

---

## 阶段 3：双人一致性

| 项 | 结果 |
|----|------|
| B 见 A 追评 / B 追评 A / B 见贴画 / presence / companion | Pass |
| 画板 revision 冲突 409 + 恢复 | Pass（见 W7c/W7d） |

---

## 阶段 4–5：性能与安全

### 热路径（ms，各 3 次）

| 路径 | 样本 |
|------|------|
| `/api/health` | 182 / 61 / 57 |
| `/home` | 142 / 118 / 114 |
| `/time/timeline` | 176 / 128 / 139 |
| `/api/entries?limit=12` | 144 / 162 / 136 |
| `/places/map` | 116 / 107 / 117 |

### 本地门禁

- `pnpm typecheck` Pass
- `pnpm test` 36/36 Pass
- `pnpm test:security` 3/3 Pass

### 计费只读（`tcb DescribeBillingInfo`）

| 项 | 结果 |
|----|------|
| 套餐 | 体验版 `baas_trial`，Status NORMAL |
| `EnableOverrun` | **false**（未开超限） |
| `IsAutoRenew` | false |
| 到期 | 2027-01-30 |
| 用量告警细项 / 控制台告警规则 UI | Skip：CLI 未返回告警规则列表；超限开关已用 API 核实为关 |

---

## 代理不可达（Skip，非用户待办）

| ID | 原因 |
|----|------|
| `P.poll.visibility.code` | 无浏览器 MCP；代码已审查 `visibilityState===visible` 才轮询 |
| `P.bookmarks.device` | 无法读取手机/浏览器书签 |
| `P.coldstart.scaleToZero` | 短观察未见到缩 0；不编造秒数 |

---

## 清理

| 项 | 结果 |
|----|------|
| 删除本轮 obs-qa entries | Pass（deleted 3） |
| 首页 HTML 无 `obs-qa-` | Pass |

---

## 收口判定

- **P0 写通道**：全绿，昨天同源误杀类未复现  
- **扩展同源写**（DELETE/PATCH/footprints/notifications/inbox/settings/uploads）：全绿  
- **展示断言 + 瓦片 + 签名 TTL**：全绿  
- **测试数据**：已清，不污染「最近回忆」

观察期最短结束日仍为 **2026-08-06**；期满前不删 Neon / R2 / Vercel。
