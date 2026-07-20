# AGENTS.md ——「我们的小星球」审计与重构工作契约

## 1. 适用范围与优先级

- 本文件位于仓库根目录，适用于整个仓库。
- 在不违反 system / developer 指令的前提下，本文件是本项目的长期硬约束，高于普通单次对话要求。
- 单次要求若与本文件冲突，先指出具体冲突并停止；只有用户明确要求修订本文件时，才可改变红线，不能把一句笼统的“确认”视为豁免。
- 当前项目处于「审计与重构」阶段：允许审计、修复已确认问题和必要重构；不接受新功能、顺手优化或无关清理。
- 每次开始工作都重新读取当前 `AGENTS.md`、`package.json` 和与本阶段直接相关的文件；文档与代码冲突时，以可验证的当前代码为事实，并在产物中记录漂移。

## 2. 项目事实

- 产品：「我们的小星球」，仅供两人使用的私密回忆网站；聊天、照片、音视频、地图足迹、邮箱、双方称呼和关系信息均按最高敏感级处理。
- 框架：Next.js 16.2.10 App Router、React / React DOM 19.2.7、TypeScript 5.9.3 strict、ESM。
- Node.js：README 要求 22+，但仓库没有 `engines`、`.nvmrc` 或其他机器约束；不得猜测实际运行时版本。
- 包管理器：pnpm，由 `pnpm-lock.yaml` / `pnpm-workspace.yaml` 确认。只用 pnpm，不混用 npm、yarn、bun。
- 数据模式：`APP_DATA_MODE` 在 demo / live 间切换。live 使用 Drizzle ORM 0.45.2 + Neon Postgres / Neon Auth；媒体使用 Cloudflare R2 和 S3 SDK 预签名 URL。
- 外部数据边界包括：Neon DB/Auth、Cloudflare R2、OpenAI、智谱 GLM、高德、Nominatim，以及浏览器访问的地图瓦片服务。
- 当前脚本以 `package.json` 为准：
  - `dev`: `next dev`
  - `build`: `next build`
  - `start`: `next start`
  - `typecheck`: `tsc --noEmit`
  - `test:security`: Node test，仅覆盖 `tests/security/internal-path.test.mts`
  - 另有 `tests/**/*.test.mts`；没有通用 `test`、coverage、lint 或 formatter script。
- 脚本存在不代表允许执行；审计期的命令限制见第 7 节。

## 3. 目录和信任边界

- `app/`：App Router 页面、Route Handler、Server Action；页面默认是 Server Component，只有显式 `"use client"` 文件属于客户端。
- `components/`：客户端交互和共享 UI。审计 props、序列化数据和 `fetch()` 响应时必须把这里纳入浏览器边界。
- `lib/auth/`：Neon Auth、session、邮箱 allowlist。
- `lib/db/`、`lib/data/`：Drizzle schema、Neon client、demo/live 数据仓库。
- `lib/r2/`、`lib/media/`：R2 预签名、对象操作和媒体校验。
- `lib/http/`、`lib/security/`：HTTP 安全与输入/内部路径处理。
- `features/import-review/`、`scripts/import/`：处理源码外的真实聊天与媒体；只能审代码，不能看数据。
- `app/api/import-review/candidate/[id]/summary/route.ts`：OpenAI / GLM 数据出境入口。
- `app/api/geocode/search/route.ts`：高德 / Nominatim 数据出境入口。
- `app/api/uploads/presign/route.ts`、`lib/r2/client.ts`：R2 授权和预签名边界。
- `app/api/import-review/publish/route.ts`、`scripts/import/publish.mjs`：发布边界，只允许静态阅读。
- `drizzle/`：public schema migration；`drizzle-auth-introspection/`：Neon Auth introspection 产物。
- `tests/`：本地 `node:test`；运行前仍要确认目标测试不会加载环境、访问网络或读取私密数据。
- `audit/`：阶段产物目录，可能尚不存在；只有已确认的审计阶段才允许创建。

## 4. 红线与事前批准

以下编号保持稳定，后续对话可直接引用。第 1–6、9 条是默认绝对红线；第 7–8 条必须逐次获得明确、具体的事前批准。

1. **Git 与破坏性操作**
   - 不执行 `push`、force-push、远端删除、fetch、pull，或通过 `gh` / 托管平台修改远端状态。
   - 不对已推送分支 rebase；不执行 `reset --hard`、`clean`、覆盖式 `checkout` / `restore`。
   - 默认不 stage、commit、建分支或本地 rebase；只有用户在当前阶段明确要求时才做。
2. **文件删除**
   - 不使用 `rm` 或等价方式删除项目文件。
   - 确需“删除”时，移动到 `_trash/YYYYMMDD-HHMMSS/<原相对路径>`，由用户人工清理；不得覆盖已有 trash。
   - 用户明确要求的普通 rename / move 不算删除；不得把仓库外私密数据或秘密文件搬进 `_trash/`。
3. **真实密钥和 `.env.local`**
   - 永不打开、读取、打印、复制、解析或修改 `.env.local`，也不为确认“是否已配置”而读取它。
   - 禁止 `env`、`printenv`、`--env-file...`，以及任何显式或隐式加载 `.env.local` 的命令。
   - 环境变量只能报告名称、静态用途和引用位置；值统一写 `<REDACTED>`。
4. **外部服务和网络**
   - 审计只做静态分析；不发起任何网络请求。
   - 不连接 Neon DB/Auth、真实 R2 bucket、OpenAI/GLM、高德/Nominatim、地图瓦片、Git 托管平台、包 registry 或其他外部服务。
   - 不使用 `curl`、浏览器、web 搜索、外部 connector 或可能触发网络的应用代码来验证结论。
5. **真实私密数据**
   - 不读取、解析或输出 `IMPORT_DATA_ROOT`、`IMPORT_WORK_ROOT`、`IMPORT_PUBLISH_ROOT` 的值。
   - 不跟随这些路径、symlink 或 repo 外路径；不遍历 `/Datas/`、`/data-work/` 或真实照片、聊天导出、工作产物。
   - 只能分析处理数据的源码、类型和控制流；报告不得复述真实聊天、媒体元数据、精确位置、双方 label 或邮箱。
6. **发布与真实写入**
   - 不调用 import-review publish Route，不 spawn 发布子进程，不运行 dry-run / apply 发布脚本或媒体 backfill。
   - 不读取、设置或修改运行时 `PUBLISH_CONFIRMED` 闸门。
7. **数据库和 schema（先问）**
   - 静态读取 `lib/db/schema.ts`、migration 和 introspection 文件可以。
   - 运行任意 `db:*`、migration、`drizzle-kit push/generate/migrate/pull/studio`，或修改 `lib/db/schema.ts`、`drizzle/`、`drizzle-auth-introspection/` 前，必须说明影响并取得单独批准。
8. **依赖（先问）**
   - 安装、升级、降级、移除依赖，运行 `pnpm install/add/remove/update/dlx`，或修改 `package.json` / lockfile 前，必须取得单独批准。
9. **秘密报告格式**
   - 不主动搜索 `.env.local` 中的秘密。仅当正常静态阅读在其他源码中发现硬编码 key/token 时，报告“文件:行号 + 类型 + 前4位 + 长度”，绝不输出完整值。
   - 密码、连接串、cookie/session、预签名 URL、私有 URL 不输出完整值；只报类型、位置、长度和 `<REDACTED>`。
   - 扫描命令不得把匹配行或秘密本体打印到 tool output。

## 5. 工作树和改动边界

- 开始时执行只读 `git status --short --branch`，把既有修改视为用户资产。
- 不清理、覆盖、格式化或回滚既有 dirty changes；若任务与其重叠且无法安全区分，停下来询问。
- “诊断 / 审计 / review”默认不授权业务源码修改。
- “只读审计”表示业务源码、配置、数据和 Git 状态只读。用户明确点名的 `audit/<stage>.md`、`audit/00-plan.md`，以及必要时的 `audit/99-backlog.md`，是唯一允许的写入例外。
- 如果阶段没有明确点名产物，默认零写入。`audit/` 不存在时，只能在已确认且明确要求落盘的阶段创建。
- 修复或重构阶段只改用户确认的范围；超出范围的问题进入 backlog，不顺手修。
- 使用 `apply_patch` 做文本编辑；不要用 shell 重定向或脚本覆盖文件。不要做全仓自动格式化。

## 6. 每个阶段的强制流程

1. **开始前**
   - 读取本文件、相关阶段说明和现有 `audit/00-plan.md`（若存在）。
   - 复述：目标、扫描/修改范围、允许写入的文件、明确不覆盖的内容、完成标准。
   - 等用户回复「确认」后再执行；确认只覆盖刚刚复述的范围。
2. **执行中**
   - 先记录当前 dirty worktree，再按证据链工作。
   - 执行所需动作若会越过红线，立即停止并询问，不尝试绕过。
   - 仅扫描到范围外问题时：若本阶段已授权 audit 写入，则脱敏追加 `audit/99-backlog.md`；否则只在结束汇报中说明。
   - 不自动扩大范围，不把观察升级为修复。
3. **结束时**
   - 将指定产物落盘，复核引用的文件和行号。
   - 更新 `audit/00-plan.md` 中当前阶段状态；不存在时仅在本阶段已明确授权的情况下创建。
   - 检查最终 `git status` / diff，确认只有本阶段允许的文件变化。
   - 停下来汇报并等待 review；不自动进入下一阶段。

## 7. 审计期命令矩阵

### 默认允许的静态、只读命令

- `rg`、`sed`、`find`、`wc`、`jq`、`nl`，但必须显式避开 `.env.local`、`.git/`、`.next/`、`node_modules/`、私密 roots 和 repo 外路径。
- `git status`、`git diff`、`git log`、`git show`、`git branch --show-current` 等本地只读 Git 命令。
- 无写入 typecheck：`pnpm exec tsc --noEmit --incremental false --pretty false`。若本地 binary 不存在，停下来，不安装。
- `pnpm test:security`，以及经静态检查确认无环境/网络/私密数据访问的单个 `node:test` 文件。

### 审计期默认禁止执行

- `pnpm dev`、`pnpm review`、`pnpm start`、`pnpm build`：可能加载 `.env.local`，且 build 会写 `.next`。
- 普通 `pnpm typecheck`：`tsconfig.json` 开启 incremental，可能改写 `tsconfig.tsbuildinfo`；使用上面的无写入命令。
- 全部 `pnpm db:*`、`pnpm data:*`、缩略图回填、publish 相关命令。
- 未先阅读目标代码的测试、会启动应用服务器的命令、任何网络或依赖安装命令。
- 不存在 lint / formatter script 时，不自行引入工具或假装已执行。

## 8. 审计产物规范

- 审计报告必须写入用户指定的 `audit/` 文件，不得只在对话中给结论。
- 报告开头必须包含：
  - 生成时间（明确 `Asia/Shanghai`）
  - 阶段与扫描范围
  - 扫描方法和实际执行的命令
  - 本次未覆盖的部分及原因
- 每条问题使用：

  `[确认/疑似] [严重度: 高/中/低] [类别] 文件:行号 | 现象 | 具体触发场景 | 影响 | 建议修法 | 工作量`

- `[确认]`：读到完整代码路径，能说明入口、条件、数据/控制流和结果。
- `[疑似]`：只有模式匹配或缺少运行态证据；不得写成确定事实。
- 建议必须能直接转化为一个明确 commit；禁止“遵循最佳实践”“加强安全”等空话。
- 工作量写清涉及文件、验证步骤或合理的时间级别，不给无依据的精确工时。
- 隐私审计必须单列「需要用户做价值判断的项」；对合法但敏感的数据流只陈列事实和选项，不替用户决定。
- 不在报告中粘贴真实私密内容、完整秘密、签名 URL、连接串或私有 URL。

## 9. 性能铁律

- 这是双人应用，不优化并发、吞吐、横向扩展或“大规模”场景。
- 只关注 serverless 长时资源泄漏、内存无界增长、请求重叠。
- 性能 finding 必须附可复现的本地 synthetic 测量数字和方法；不能安全实测时，不形成性能条目，不能用静态模式冒充数据。
- 性能测试不得读取真实数据、加载 `.env.local` 或访问外部服务。

## 10. 沟通与交付

- 使用中文，技术术语保留英文。
- 先给文件/行号和判断依据，再给结论；不确定就标明并询问，禁止猜测或用默认值补全。
- 中间进度简短说明已覆盖边界、剩余工作和是否触及阻塞；不得回显敏感内容。
- 最终汇报只包含：完成状态、产物链接、验证结果、未覆盖项和需要用户决定的事项。
- 不自动 commit、push、部署或进入下一阶段。
