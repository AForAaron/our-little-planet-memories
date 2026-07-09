import { LockKeyhole } from "lucide-react";
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
    <main className="grid min-h-screen overflow-hidden bg-[var(--color-bg)] md:grid-cols-[1.05fr_1fr]">
      <section className="hero cosmos-panel relative hidden min-h-screen flex-col justify-between overflow-hidden p-16 text-[var(--color-on-accent)] md:flex lg:p-[72px]">
        <div className="absolute left-[44%] top-[46%] size-[108px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_32%_28%,var(--color-on-accent),var(--color-amber-soft)_55%,var(--color-accent)_100%)] shadow-[var(--shadow-accent)]" />
        <div className="absolute left-[44%] top-[46%] size-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color-mix(in_srgb,var(--color-on-accent)_20%,transparent)]" />
        <div className="absolute left-[44%] top-[46%] size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-[color-mix(in_srgb,var(--color-on-accent)_35%,transparent)]" />
        <span className="tiny-star left-[22%] top-[18%]" />
        <span className="tiny-star left-[68%] top-[30%] [animation-delay:.8s]" />
        <span className="tiny-star left-[30%] top-[62%] [animation-delay:1.4s]" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-[42px] place-items-center rounded-[13px] border border-[color-mix(in_srgb,var(--color-on-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--color-on-accent)_22%,transparent)] backdrop-blur">
            <svg className="size-[22px]" viewBox="0 0 24 24" fill="none">
              <circle cx="9.5" cy="12" r="5.5" stroke="var(--color-on-accent)" strokeWidth="1.6" />
              <circle cx="14.5" cy="12" r="5.5" stroke="var(--color-on-accent)" strokeWidth="1.6" />
            </svg>
          </span>
          <span className="text-[15px] font-medium tracking-[.04em]">张张和沈沈</span>
        </div>
        <div className="relative max-w-[420px]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--color-on-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--color-on-accent)_18%,transparent)] px-3.5 py-2 text-xs tracking-[.18em]">
            <span className="size-1.5 rounded-full bg-[var(--color-on-accent)]" /> PRIVATE BY DESIGN
          </div>
          <h1 className="font-heading text-[46px] font-semibold leading-[1.24] drop-shadow-sm">
            我们的
            <br />
            小星球
          </h1>
          <p className="mt-5 text-base leading-8 opacity-90">
            一个只属于两个人的私密宇宙。
            <br />
            把日子、脚步和心动，都轻轻收进来。
          </p>
        </div>
        <p className="relative text-[13px] opacity-80">© 2026 · 只对彼此可见</p>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-6 py-12">
        <span className="tiny-star right-[15%] top-[10%] bg-[var(--color-accent)]" />
        <span className="tiny-star bottom-[12%] left-[14%] bg-[var(--color-amber)] [animation-delay:1s]" />
        <div className="w-full max-w-[400px] rounded-[28px] border border-line bg-[var(--color-surface)] p-8 shadow-lift sm:p-10">
          <div className="mb-9 md:hidden">
            <span className="brand-mark mb-5" aria-hidden="true">
              <svg className="brand-orbit" viewBox="0 0 24 24" fill="none">
                <circle cx="9.5" cy="12" r="5.5" stroke="var(--color-on-accent)" strokeWidth="1.6" />
                <circle cx="14.5" cy="12" r="5.5" stroke="var(--color-on-accent)" strokeWidth="1.6" />
              </svg>
            </span>
            <h1 className="font-heading text-2xl font-semibold">我们的小星球</h1>
          </div>
          <span className="eyebrow"><LockKeyhole size={14} /> Private space</span>
          <h2 className="mt-3 font-heading text-[27px] font-semibold text-text">欢迎回来</h2>
          <p className="mt-2 text-sm leading-6 text-muted">只属于两个人的私密空间。</p>

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
              <input className="field" name="email" type="email" autoComplete="email" placeholder="you@ours.space" required />
            </label>
            <PasswordField
              name="password"
              label="密码"
              autoComplete="current-password"
              placeholder="只有你们知道的暗号"
            />
            <button className="button-primary mt-2 h-[54px] w-full text-base" type="submit">进入我们的星球</button>
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
        </div>
      </section>
    </main>
  );
}
