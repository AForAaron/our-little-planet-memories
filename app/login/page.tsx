import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { BrandIcon } from "@/components/brand-icon";
import { PasswordField } from "@/components/password-field";
import {
  resendVerificationEmail,
  signIn,
  verifyEmailCode,
} from "./actions";
import { isLiveMode, isNeonConfigured } from "@/lib/config/backend";

export const metadata = { title: "回到小星球" };

export default async function LoginPage({
  searchParams,
}: {
    searchParams: Promise<{
      error?: string;
      registered?: string;
      verification?: string;
      verificationSent?: string;
      verified?: string;
    }>;
}) {
  const {
    error,
    registered,
    verification,
    verificationSent,
    verified,
  } = await searchParams;
  const configured = isLiveMode() && isNeonConfigured();

  return (
    <main className="grid min-h-screen overflow-x-hidden bg-[var(--color-bg)] md:grid-cols-[1.05fr_1fr]">
      <section className="hero cosmos-panel relative hidden min-h-screen flex-col justify-between overflow-hidden p-16 text-[var(--color-on-accent)] md:flex lg:p-[72px]">
        <BrandIcon className="absolute left-[61%] top-[48%] h-[300px] w-[420px] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_26px_32px_rgb(110_70_50_/_24%)]" variant="hero" />
        <div className="relative flex items-center gap-3">
          <BrandIcon className="h-8 w-11 object-contain" variant="logo" />
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
            <span className="brand-mark brand-mark-auth mb-5" aria-hidden="true">
              <BrandIcon className="brand-orbit" variant="logo" />
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
              注册完成。请输入邮件中的 6 位验证码，再使用新账号登录。
            </p>
          )}
          {verificationSent === "1" && (
            <p className="mt-5 rounded-soft border border-line bg-[var(--color-surface-soft)] px-4 py-3 text-sm leading-6 text-accent" role="status">
              验证码已发送，有效期为 10 分钟。请在下方输入邮件中的 6 位数字。
            </p>
          )}
          {verified === "1" && (
            <p className="mt-5 rounded-soft border border-line bg-[var(--color-surface-soft)] px-4 py-3 text-sm leading-6 text-accent" role="status">
              邮箱验证完成，请使用原密码登录。无需重新注册。
            </p>
          )}
          {verification === "required" && (
            <section className="mt-5 rounded-soft border border-line bg-[var(--color-surface-soft)] p-4 text-sm leading-6 text-muted" aria-labelledby="verification-title" role="alert">
              <p id="verification-title" className="font-semibold text-text">
                账号已经存在，无需重新注册
              </p>
              <p className="mt-1">请重新发送验证邮件，完成验证后使用原密码登录。</p>
              <form action={resendVerificationEmail} className="mt-4 grid gap-3">
                <label className="label">
                  已注册的白名单邮箱
                  <input className="field" name="email" type="email" autoComplete="email" required />
                </label>
                <button className="button-secondary h-11 w-full" type="submit">
                  重新发送验证邮件
                </button>
              </form>
            </section>
          )}
          {verification === "code" && (
            <section className="mt-5 rounded-soft border border-line bg-[var(--color-surface-soft)] p-4 text-sm leading-6 text-muted" aria-labelledby="verification-code-title">
              <p id="verification-code-title" className="font-semibold text-text">
                输入邮箱验证码
              </p>
              <p className="mt-1">无需重新注册。请填写邮件中的 6 位数字。</p>
              <form action={verifyEmailCode} className="mt-4 grid gap-3">
                <label className="label">
                  6 位验证码
                  <input
                    className="field"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                  />
                </label>
                <button className="button-primary h-11 w-full" type="submit">
                  完成邮箱验证
                </button>
              </form>
              <div className="mt-3 grid gap-2 text-center">
                <Link href="/login?verification=required" className="font-semibold text-accent">
                  验证码过期或没有收到？重新发送
                </Link>
                <Link href="/login" className="font-semibold text-muted hover:text-text">
                  返回密码登录
                </Link>
              </div>
            </section>
          )}

          {!configured && (
            <div className="mt-5 rounded-soft border border-line bg-[var(--color-surface-soft)] p-4 text-sm leading-6 text-muted">
              当前使用本地演示数据。可以先
              <Link href="/home" className="mx-1 font-semibold text-accent underline">进入预览模式</Link>
              制作完整界面；配置 Neon 后再切换到 live。
            </div>
          )}

          {verification !== "code" && (
            <>
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
                <div className="mt-5 grid gap-2 text-center text-sm text-muted">
                  <p>
                    第一次来？
                    <Link href="/register" className="ml-1 font-semibold text-accent">
                      使用白名单邮箱注册
                    </Link>
                  </p>
                  <Link href="/login?verification=required" className="font-semibold text-accent">
                    已经注册但没有收到验证邮件？
                  </Link>
                </div>
              )}
            </>
          )}
          <p className="mt-7 text-center text-xs text-muted">登录即表示：今天也要好好记录生活。</p>
        </div>
      </section>
    </main>
  );
}
