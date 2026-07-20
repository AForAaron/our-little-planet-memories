# 我们的小星球

只给两个人使用的私密回忆网站。目标后端固定为 Neon Postgres、Neon Auth 和 Cloudflare R2；本地照片与聊天审核工具独立运行，不会自动上传未批准内容。

## 技术栈

- Next.js 16 + TypeScript + Tailwind CSS
- Neon Postgres + Drizzle ORM
- Neon Auth（邮箱和密码）
- Cloudflare R2 私有 bucket
- Vercel
- Leaflet + OpenStreetMap（依赖安装恢复后启用交互地图）

## 两种运行模式

环境变量 `APP_DATA_MODE` 是唯一模式开关：

- `demo`：默认值。使用本地演示数据，不连接数据库、认证或对象存储，适合先制作网页。
- `live`：启用真实后端。只有数据库迁移、Auth、两个 profile、R2 和白名单全部完成后才能开启。

缺少环境变量时不会自动降级为半连接状态；`live` 配置不完整会直接报错。

## 本地启动

要求 Node.js 22 或更新版本。

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

打开 `http://localhost:3000`。

## Neon 与 Auth

1. 在 Neon 创建项目并启用 Auth。
2. 从 Connect 页面复制 pooled connection string 到 `DATABASE_URL`。
3. 从 `Project → Branch → Auth → Configuration` 复制 Auth URL。
4. 用 `openssl rand -base64 32` 生成 Cookie Secret。
5. 在 Auth 的邮件配置中启用邮箱验证；应用只允许已验证的白名单邮箱读取私密数据。
6. 在 `ALLOWLIST_EMAILS` 中填写且只填写两个邮箱。
7. 保持 `APP_DATA_MODE=demo`。
8. 先拉取 Neon 管理的 Auth schema，确认真实用户 ID 类型：

   ```bash
   pnpm db:auth:pull
   ```

9. 对照 `drizzle-auth-introspection/` 检查 `lib/db/schema.ts` 中的 `profiles.id`。
10. 生成并检查应用表 migration：

   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

`drizzle.auth.config.ts` 只读取 `neon_auth`，绝不迁移它；`drizzle.config.ts` 只管理 `public` 应用表。

## Cloudflare R2

1. 创建私有 bucket `our-little-planet-memories`。
2. 创建只允许该 bucket 的 Object Read & Write API Token。
3. 填写 `R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY` 和 `R2_BUCKET`。
4. 添加允许 `http://localhost:3000` 的 `GET`、`PUT`、`HEAD` CORS；部署后再加入稳定正式 HTTPS 域名 `https://our-little-planet-memories.vercel.app`。不要使用每次部署都会变化的 `...-<deployment>.vercel.app` 地址。
5. 不开启公开访问或 `r2.dev`。

应用只在数据库中保存 `r2_key`，读取使用短时效签名 GET URL。浏览器通过 `/api/uploads/presign` 获得短时效 PUT 地址并直接上传，支持图片、MP4/WebM 和常见音频。

## 切换真实后端

在以下项目全部通过后，将 `.env.local` 改为：

```dotenv
APP_DATA_MODE=live
```

切换前必须确认：

- 两个邮箱均可登录；
- 两个 Neon Auth 用户都有对应 `profiles` 行；
- 未在白名单中的账号被拒绝；
- 文本回忆 CRUD 正常；
- 测试图片可上传、签名读取和删除；
- R2 bucket 仍为私有；
- `pnpm typecheck` 和 `pnpm build` 通过。

## 本地数据审核

原始数据已经迁移至源码目录之外的 `Web-private/`；三个 `IMPORT_*_ROOT` 必须配置为绝对路径，缺失时脚本拒绝运行。审核台仅在本机开启：

```bash
pnpm data:verify
pnpm data:compare-zips
export REVIEW_ACCESS_TOKEN="$(openssl rand -hex 32)"
pnpm review
```

打开 `http://127.0.0.1:3000/import-review`。300 张照片按地点和连续访问聚合成事件，并支持按指定照片再次拆分；4 个独立相册 MP4 会关联到对应照片事件。人工状态单独保存在 `review-state.json`。

永远先执行：

```bash
pnpm data:dry-run
```

未明确确认前不要运行 `pnpm data:publish`。

## 关键目录

```text
app/                         页面、Auth API、Server Actions
components/                  网站共享组件
features/import-review/      仅本机启用的审核功能
lib/auth/                    Neon Auth 服务端封装与双邮箱守卫
lib/config/                  demo/live 与环境变量验证
lib/data/                    演示数据和 Neon 数据仓库
lib/db/                      Drizzle client 与 public schema
lib/r2/                      私有对象上传、读取签名和删除
scripts/import/              本地清洗、验证和发布脚本
docs/                        数据审计、计划与旧原型归档
drizzle/                     正式应用 migration
drizzle-auth-introspection/  Neon Auth 只读 introspection（生成后）
```

私密目录：

```text
Web-private/
  raw/Photos/
  raw/wechat/archives/
  raw/wechat/exports/current/
  work/import/
  publish/
  backups/
```

## 当前云端检查点

源码、正式 migrations、白名单注册、首次设置、事件详情、时间模块、日记、愿望、观影、探店、多媒体签名上传及审核改造已经就绪。尚需用户创建 Neon/Auth/R2 并填写 `.env.local`，才能执行 introspection、migration 和真实凭据验收。

地图会在用户明确点击后才向 OpenStreetMap 请求瓦片；坐标选择器在主服务不可用时才会使用 CARTO 作为备用底图。

## 验证

```bash
pnpm data:verify
pnpm typecheck
pnpm build
```
