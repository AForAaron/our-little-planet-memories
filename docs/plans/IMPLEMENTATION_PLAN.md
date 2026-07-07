# 实施计划

## 当前架构

- 网页可以在 `APP_DATA_MODE=demo` 下独立制作。
- 真实后端固定为 Neon Postgres + Neon Auth + Cloudflare R2。
- Drizzle 只管理 `public` schema；`neon_auth` 只允许 introspect。
- R2 bucket 保持私有，数据库只存对象 key。
- 本地审核台与正式网站分离，未批准数据不得上传。
- 私密原始数据和工作数据已迁移到 `Web-private`，源码目录不再保存副本。
- 正式 Drizzle migrations 已生成，但尚未连接真实 Neon 执行。
- 时间、日常、事件详情、探店数据层和媒体上传接口已完成。
- 交互式 Leaflet 地图因依赖安装权限受限而待完成。

## 后端接入顺序

1. 创建 Neon 项目并启用 Neon Auth。
2. 创建 R2 私有 bucket、限定 bucket 的 API Token 和 CORS。
3. 将凭据写入 `.env.local`，继续保持 `APP_DATA_MODE=demo`。
4. 执行 `pnpm db:auth:pull`，核对 Auth 用户 ID 类型。
5. 调整并确认 `lib/db/schema.ts`。
6. 执行 `pnpm db:generate`，人工检查 migration。
7. 执行 `pnpm db:migrate`。
8. 创建两个 Auth 用户和对应 `profiles`。
9. 验证登录、白名单、文本 CRUD 和单张测试图片。
10. 验证通过后将 `APP_DATA_MODE` 改为 `live`。

## 网页建设顺序

1. 完成首页 Hub 与事件详情。
2. 完成世界足迹地图、缩放、标记聚合和事件弹窗。
3. 完成时间轴、纪念日、第一次和里程碑。
4. 完成共同日记、愿望清单和观影记录。
5. 完成移动端、空状态、错误状态和加载状态。
6. 最后恢复真实事件审核并导入首批 10–20 个事件。

## 数据审核原则

- 300 张照片按“同一次到访的地点事件”聚合审核，而不是逐张审核。
- 同地点、同一次连续访问的照片只形成一个事件和一个相册。
- 同地点但跨日期、属于不同到访的照片保持为不同事件。
- 地图只读取隐私处理后的坐标。
- 原始聊天、精确住宅坐标和未批准媒体永不进入云端。
