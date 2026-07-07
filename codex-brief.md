# 项目搭建说明书：情侣记忆网站

这是一份完整的项目需求说明。请从零开始搭建这个项目的整体结构。请严格遵守本文档的技术选型、目录约定、数据模型和"交付顺序"。遇到本文未指定的细节，选择简单、易维护、易扩展的方案，并在代码里留注释说明。

---

## 1. 项目是什么

一个只给两个人（我和我女朋友）使用的私密网站，用来记录我们的共同生活与回忆。核心体验：

- **主页是一个卡片式的 hub**，展示几个"板块"入口。
- 点进板块后，是该板块下的**具体功能**；板块分三大类：**关于时间、关于足迹、关于日常**。
- 内容由我们俩手动添加；未来还会把筛选过的微信聊天记录导入进来（本期只需在数据结构上预留，不用实现导入功能）。

功能全景（本期不全做，见第 8 节交付顺序）：

- **关于时间**：恋爱时间轴、"在一起 XXX 天"计数器、纪念日倒计时、"第一次"合集、重要里程碑。
- **关于足迹**：足迹地图（去过的地方打点）、探店/美食地图（带评分）。
- **关于日常**：共同日记 / 留言板、恋爱愿望清单、观影追剧记录。

---

## 2. 技术栈（固定，不要替换）

- **前端**：Next.js（App Router）+ TypeScript
- **样式**：Tailwind CSS
- **数据库**：Neon（Serverless Postgres）
- **ORM / 数据库访问**：Drizzle ORM + drizzle-kit，驱动用 `@neondatabase/serverless` 的 `neon-http`（Vercel serverless / edge 都可用，不用自己管连接池）
- **认证**：Neon Auth（用户会被同步进 Postgres 的 `neon_auth` schema）
- **文件存储**：Cloudflare R2（S3 兼容），用 `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- **部署**：Vercel
- **地图**（足迹板块用，本期先不实现功能，但选型先定下）：预留使用 Leaflet + OpenStreetMap（免费、无需 key）。

> 后端说明：数据库仅使用 Neon Postgres，认证仅使用 Neon Auth，文件仅使用 R2，三者由 Next.js 应用层粘合。

---

## 3. 三条必须贯穿始终的核心原则

1. **数据模型已定死**（见第 5 节），请严格按它建表，不要自己改结构。它已经预留了"微信导入"和"双人协作"，本期不用为这两件事写功能，只要结构对。
2. **所有视觉都必须走"设计变量 / design tokens"**（见第 7 节）。任何组件都**禁止**写死颜色、字体、圆角、阴影的具体值，必须引用统一的 CSS 变量 / theme 配置。目的是以后能整体换主题而不用重构。这一条最重要，请从第一个组件就贯彻。
3. **先做通一个"竖切片"，不要把所有功能铺开做半成品**（见第 8 节）。

---

## 4. 认证与隐私

- 全站内容都是私密的，**未登录不能看任何内容**，只能看到登录页。
- 用 **Neon Auth**，登录方式用邮箱 + 密码（选实现最简单的；如想要 Google 登录可后续再加）。
- **访问控制不靠数据库 RLS，靠应用层白名单**（这是本项目的唯一安全边界）：
  - 用环境变量 `ALLOWLIST_EMAILS`（逗号分隔的两个邮箱）保存允许访问的账号。
  - 实现一个辅助函数 `requireCoupleUser()`：在每个 Server Action、Route Handler、以及受保护页面的入口统一调用；逻辑为"存在有效 Neon Auth session **且** 当前用户邮箱在 `ALLOWLIST_EMAILS` 内 → 放行；否则重定向到登录页 / 返回 403"。
  - 因为只有我们俩用，所有已放行用户都能读写全部数据，**不需要按行做任何 RLS 策略**。即使有第三者注册了账号，只要邮箱不在白名单，`requireCoupleUser()` 就会拦下，什么都看不到。
- 登录后，把用户信息写入 / 关联到 `profiles` 表（`profiles.id` 对应 Neon Auth 的用户 id，见第 5 节）。

---

## 5. 数据库结构

设计核心：用一张 `entries` 主表撑起 时间轴 / 日记 / 第一次 / 里程碑 等多个模块，各模块只是"同一批数据的不同视图"。已预留微信导入（`source` / `source_ref`）与双人协作（`author_id`）。

**实现方式（重要）**：

1. 先在 Neon 面板 **Enable Neon Auth**；它会在数据库里创建 `neon_auth` schema（含同步的用户表）。
2. 用 `drizzle-kit pull` **introspect** 现有数据库，把 `neon_auth` 的同步用户表拉进 Drizzle schema，这样应用表才能和用户表建关系、也能拿到用户 id 的确切类型。
3. 用 **Drizzle schema（`drizzle-orm/pg-core`）** 定义下面这些应用表，再用 `drizzle-kit generate` + `drizzle-kit migrate` 迁移到 Neon。
4. 下面的 SQL 是**数据模型规格说明**（表、字段、索引、关系以它为准）；请转成等价的 Drizzle schema，**不要照抄其中的 RLS —— 本项目没有 RLS**。`profiles.id` 与各处 `author_id` 的类型请以第 2 步 introspect 出来的 Neon Auth 用户 id 类型为准。

```sql
create extension if not exists "pgcrypto";

-- 1. 用户资料（关联 Neon Auth 同步用户表）
-- 注意：id 的类型 = Neon Auth 用户 id 的类型，以 drizzle-kit pull 出来的为准。
create table public.profiles (
  id           <neon_auth_user_id_type> primary key,  -- 关联 neon_auth 同步用户表
  display_name text not null,
  avatar_url   text,
  color        text,            -- 区分两人的主题色
  theme        text,            -- 该用户偏好的主题名（配合第 7 节）
  created_at   timestamptz not null default now()
);

-- 2. 关系设定（单行，驱动"在一起 XXX 天""纪念日"）
create table public.relationship (
  id             int primary key default 1,
  title          text,          -- 站点标题
  together_since date,           -- 确定关系的日子
  first_met_on   date,           -- 第一次见面
  partner_a      <user_id_type> references public.profiles(id),
  partner_b      <user_id_type> references public.profiles(id),
  updated_at     timestamptz not null default now(),
  constraint single_row check (id = 1)
);

-- 3. 地点（足迹地图复用）
create table public.places (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  category   text,              -- restaurant / city / attraction / other
  address    text,
  lat        double precision,
  lng        double precision,
  notes      text,
  created_at timestamptz not null default now()
);

-- 4. 记忆主表（多模块公共骨架）
create table public.entries (
  id                 uuid primary key default gen_random_uuid(),
  author_id          <user_id_type> not null references public.profiles(id),
  category           text not null,          -- moment/diary/trip/first/milestone/watch...
  title              text,
  body               text,
  happened_at        timestamptz not null,   -- 事件真正发生的时间；时间轴按它排序
  happened_precision text not null default 'day', -- exact/day/month/year
  place_id           uuid references public.places(id),
  mood               text,
  weather            text,
  rating             smallint,               -- 探店/观影通用评分 1-5
  source             text not null default 'manual', -- manual / wechat_import
  source_ref         text,                   -- 微信原始消息 id/时间戳，防重复
  is_highlight       boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index entries_happened_at_idx on public.entries (happened_at desc);
create index entries_category_idx    on public.entries (category);

-- 5. 媒体（文件本体放 R2，这里只存 object key，不存完整/签名 URL）
create table public.media (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.entries(id) on delete cascade,
  r2_key     text not null,               -- R2 对象 key，例如 entries/<uuid>/<filename>
  mime       text,                        -- image/jpeg、image/png、image/webp...
  type       text not null default 'image', -- image / video
  caption    text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 6. 愿望清单
create table public.wishlist_items (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  is_done       boolean not null default false,
  done_at       timestamptz,
  done_entry_id uuid references public.entries(id),
  created_by    <user_id_type> references public.profiles(id),
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- 本项目不使用行级安全（RLS）。访问控制在应用层用 requireCoupleUser() 完成（见第 4 节）。
```

---

## 6. 存储（Cloudflare R2）

- 图片 / 视频上传到 **Cloudflare R2** 的一个**私有** bucket（如 `memories`）。
- 数据库 `media.r2_key` 只存对象 key，**不要把文件本体、base64 或带签名的完整 URL 塞进数据库**（签名 URL 会过期）。
- R2 client（放在只在服务端运行的文件里，加 `import 'server-only'`）：
  - `S3Client({ region: 'auto', endpoint: 'https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com', credentials: {...} })`
- **上传流程**：前端选好文件 → 请求一个 Server Action `getUploadUrl`（内部先 `requireCoupleUser()`，再校验 content-type / 大小）→ 用 `PutObjectCommand` + `getSignedUrl` 生成 presigned PUT URL 返回前端 → 前端 `fetch(url, { method:'PUT', headers:{'Content-Type':type}, body:file })` 直传 R2 → 上传成功后前端把 `r2_key` 回传，服务端写 `entries` + `media` 行。
- **显示流程**：渲染时服务端为每个 `r2_key` 用 `GetObjectCommand` + `getSignedUrl` 生成短时效（如 1 小时）签名 GET URL 给前端。
- **两个必须配置的点**：
  1. presigned URL 只能用 R2 的 S3 API 域名，**不能用自定义域名**；本期直接用 S3 域名，别配自定义图床域名。
  2. 浏览器直传需要给 bucket 配 **CORS 策略**（允许你的应用 origin 的 PUT 请求 + 相关 header），否则即使签名有效上传也会被浏览器拦下。

---

## 7. 主题系统（design tokens，务必现在就打好地基）

- 建立一层集中的**设计变量**：至少包含
  `--color-bg`（背景）、`--color-surface`（卡片底）、`--color-text`、`--color-accent`（主色）、
  `--font-heading`、`--font-body`、`--radius`（圆角）、`--shadow`。
- 把它们集中放在一个 theme 文件（如 `app/theme.css` 或 Tailwind theme 扩展）里，**组件只引用变量，永远不写死具体值**。
- 至少定义 **1 套默认主题**，并预留"多主题切换"的机制：主题 = 一份变量值，切换主题 = 换整份变量（例如给 `<html>` 或 `<body>` 加 `data-theme="warm"` 这类属性来切换）。
- 每个用户的偏好主题存在 `profiles.theme` 字段里，登录后按该值应用主题（本期可先只做全局默认 + 一个切换入口，字段先接上）。

---

## 8. 交付顺序（关键：先竖切片，别铺开）

**本期只需完成以下最小闭环，其余板块只放占位页：**

1. 项目脚手架：Next.js + TS + Tailwind + Drizzle/Neon 客户端 + Neon Auth + R2 client + design tokens 地基（第 7 节）。
2. 认证与登录页（Neon Auth）；`requireCoupleUser()` 白名单守卫；未登录 / 不在白名单一律重定向到登录页。
3. 用 Drizzle 定义第 5 节结构，`drizzle-kit` 迁移到 Neon（记得先 `drizzle-kit pull` introspect `neon_auth`）；在 Cloudflare 建好 R2 bucket 并配置 CORS。
4. **主页 hub**：卡片式布局，展示三个板块入口（关于时间 / 关于足迹 / 关于日常），以及一个"在一起 XXX 天"计数器（读 `relationship.together_since` 前端计算）。
5. **"关于时间"板块页**：列出该板块下的功能入口（时间轴、计数器、纪念日、第一次、里程碑），其中**只有"时间轴"是真的能用的**，其余先做占位。
6. **时间轴页（本期的核心功能，要完整可用）**：
   - 从 `entries` 按 `happened_at` 倒序读取并以时间轴形式展示；每条显示标题、正文、发生时间、心情、关联图片（图片用第 6 节的签名 GET URL 显示）。
   - 支持**手动新增一条 entry**：填标题、正文、发生时间（`happened_at`）、心情，可选上传图片（走第 6 节 presigned PUT 直传 R2，并在 `media` 建记录存 `r2_key`）。
   - 支持编辑 / 删除自己添加的记录。

**本期不要做**：足迹地图和探店地图的实际地图功能、日记、愿望清单、观影记录、微信导入——这些只放"敬请期待"占位页即可。等时间轴这条链路验证通过，其它板块基本是复制这个模式。

---

## 9. 部署与环境变量

- 目标部署到 **Vercel**。
- 所有密钥放 `.env.local`，**不要硬编码**；同时在 README 里说明需要在 Vercel 后台配置这些变量。需要的变量：

```
# Neon 数据库
DATABASE_URL=              # Neon 的 pooled 连接串

# Neon Auth
NEON_AUTH_BASE_URL=        # Neon Auth 面板 Configuration 里的 Auth URL
NEON_AUTH_COOKIE_SECRET=   # openssl rand -base64 32 生成，≥32 字符

# Cloudflare R2
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=                 # 例如 memories

# 访问白名单（唯一安全边界）
ALLOWLIST_EMAILS=          # 逗号分隔的两个允许登录的邮箱
```

- 请在 README 里写清楚：如何本地启动、如何建 Neon 项目并 Enable Neon Auth、如何用 drizzle-kit introspect + 迁移、如何在 Cloudflare 建 R2 bucket 并配 CORS、如何在 Vercel 部署与配置以上环境变量。

---

## 10. 交付时请一并给我

- 完整的目录结构说明；
- 一份 README，包含从零到本地跑起来、再到部署上线的完整步骤；
- 明确标出哪些是"占位待实现"的部分，方便我之后逐个补全。

---

## 11. 已批准的数据导入扩展

为了支持 `Datas` 中的照片路线与精选微信事件，允许在第 5 节固定模型之上增加以下最小扩展；基础六表仍保持原有职责：

- `memory_chapters`：旅程/日期章节；
- `entries.chapter_id`：把具体记忆点归入章节；
- `places.privacy_level` / `precision_m`：记录脱敏后的坐标精度；
- `media` 增加缩略图 key、拍摄时间、宽高、SHA-256 和脱敏坐标，并允许 `audio`；
- `chat_messages`：只保存已批准事件所引用的原文，不保存完整聊天档案；
- `chat_message_media`：关联精选原文与 `media`；
- `(entries.source, entries.source_ref)` 唯一索引，保证重复导入幂等。

正式结构以 `lib/db/schema.ts` 与 `drizzle/` migration 为准。原始私密数据、精确住宅坐标和未批准聊天不得上传云端。
