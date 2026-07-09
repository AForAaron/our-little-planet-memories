import { UserPlus } from "lucide-react";
import Link from "next/link";
import { BrandIcon } from "@/components/brand-icon";
import { PasswordField } from "@/components/password-field";
import { signUp } from "@/app/login/actions";

export const metadata = { title: "建立小星球账号" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="cosmos-panel grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <span className="tiny-star left-[18%] top-[18%] bg-[var(--color-accent)]" />
      <span className="tiny-star bottom-[18%] right-[16%] bg-[var(--color-amber)] [animation-delay:1s]" />
      <section className="surface relative w-full max-w-lg rounded-[28px] p-7 shadow-lift sm:p-10">
        <span className="brand-mark mx-auto" aria-hidden="true">
          <BrandIcon className="brand-orbit" id="register-brand" />
        </span>
        <div className="mt-6 text-center">
          <span className="eyebrow"><UserPlus size={14} /> Two people only</span>
          <h1 className="mt-3 font-heading text-[27px] font-semibold text-text">建立你的账号</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            只有配置在白名单中的两个邮箱可以注册。
          </p>
        </div>

        {error && (
          <p className="mt-6 rounded-soft bg-[var(--color-accent-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}

        <form action={signUp} className="mt-7 grid gap-5">
          <label className="label">
            显示名字
            <input className="field" name="name" maxLength={40} required />
          </label>
          <label className="label">
            白名单邮箱
            <input className="field" name="email" type="email" autoComplete="email" required />
          </label>
          <PasswordField
            name="password"
            label="密码"
            autoComplete="new-password"
            placeholder="设置一个你能记住的密码"
            showHint
          />
          <button className="button-primary h-[54px] w-full text-base" type="submit">
            <UserPlus size={18} /> 创建账号
          </button>
        </form>
        <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-muted hover:text-text">
          返回登录
        </Link>
      </section>
    </main>
  );
}
