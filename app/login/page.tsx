import { Heart, LockKeyhole, Sparkles } from "lucide-react";
import Link from "next/link";
import { PasswordField } from "@/components/password-field";
import { signIn } from "./actions";
import { isLiveMode, isNeonConfigured } from "@/lib/config/backend";

export const metadata = { title: "回到小星球" };

export default async function LoginPage({
  searchParams,
}: {
    searchParams: Promise<{ error?: string; registered?: string }>;
}) {
  const { error, registered } = await searchParams;
  const configured = isLiveMode() && isNeonConfigured();

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-theme bg-surface shadow-lift md:grid-cols-[1.08fr_.92fr]">
        <section className="hero relative hidden min-h-[38rem] flex-col justify-between overflow-hidden p-12 md:flex">
          <div className="absolute -right-20 -top-20 size-72 rounded-full bg-[var(--color-on-accent)] opacity-10" />
          <div className="absolute -bottom-24 -left-16 size-80 rounded-full bg-[var(--color-on-accent)] opacity-10" />
          <div className="relative flex items-center gap-3 font-heading text-xl font-bold">
            <span className="grid size-11 place-items-center rounded-soft bg-[var(--color-on-accent)]/20">
              <Heart size={22} fill="currentColor" />
            </span>
            我们的小星球
          </div>
          <div className="relative">
            <Sparkles size={34} className="mb-6 opacity-90" />
            <h1 className="max-w-md font-heading text-5xl font-bold leading-tight">
              把平凡日子，
              <br />过成闪光回忆。
            </h1>
            <p className="mt-6 max-w-sm leading-7 opacity-85">
              这里没有陌生访客，只有我们走过的路、看过的晚霞，和还没来得及实现的愿望。
            </p>
          </div>
          <p className="relative text-sm opacity-75">只属于两个人的宇宙 · Private by design</p>
        </section>

        <section className="flex min-h-[36rem] flex-col justify-center p-7 sm:p-12">
          <div className="mb-9 md:hidden">
            <div className="mb-5 grid size-12 place-items-center rounded-soft bg-[var(--color-accent-soft)] text-accent">
              <Heart fill="currentColor" />
            </div>
            <h1 className="font-heading text-2xl font-bold">我们的小星球</h1>
          </div>
          <span className="eyebrow"><LockKeyhole size={14} /> Private space</span>
          <h2 className="mt-3 font-heading text-3xl font-bold">欢迎回家</h2>
          <p className="mt-2 text-sm leading-6 text-muted">用你们约定好的账号进入。门很小，刚好只容得下两个人。</p>

          {error && (
            <p className="mt-5 rounded-soft bg-[var(--color-accent-soft)] px-4 py-3 text-sm text-[var(--color-danger)]" role="alert">
              {error}
            </p>
          )}
          {registered === "1" && (
            <p className="mt-5 rounded-soft border border-line bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-accent">
              注册完成，请使用新账号登录。
            </p>
          )}

          {!configured && (
            <div className="mt-5 rounded-soft border border-line bg-[var(--color-surface-soft)] p-4 text-sm leading-6 text-muted">
              当前使用本地演示数据。可以先
              <Link href="/home" className="mx-1 font-semibold text-accent underline">进入预览模式</Link>
              制作完整界面；配置 Neon 后再切换到 live。
            </div>
          )}

          <form action={signIn} className="mt-7 grid gap-5">
            <label className="label">
              邮箱
              <input className="field" name="email" type="email" autoComplete="email" placeholder="name@example.com" required />
            </label>
            <PasswordField
              name="password"
              label="密码"
              autoComplete="current-password"
              placeholder="输入密码"
            />
            <button className="button-primary mt-2 w-full" type="submit">进入我们的小星球</button>
          </form>
          {configured && (
            <p className="mt-5 text-center text-sm text-muted">
              第一次来？
              <Link href="/register" className="ml-1 font-semibold text-accent">
                使用白名单邮箱注册
              </Link>
            </p>
          )}
          <p className="mt-7 text-center text-xs text-muted">登录即表示：今天也要好好记录生活。</p>
        </section>
      </div>
    </main>
  );
}
