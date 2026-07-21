"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ensureProfile } from "@/lib/auth/profile";
import { getAuth } from "@/lib/auth/server";
import {
  emailIsVerified,
  normalizeEmailAddress,
  normalizeEmailVerificationCode,
} from "@/lib/auth/verification";
import {
  getAllowlistEmails,
  isLiveMode,
  isNeonConfigured,
} from "@/lib/config/backend";

type EmailOtpVerificationClient = {
  verifyEmail(input: {
    email: string;
    otp: string;
  }): Promise<{ error?: unknown }>;
};

const EMAIL_VERIFICATION_COOKIE = "planet_email_verification";
const EMAIL_VERIFICATION_MAX_AGE_SECONDS = 10 * 60;

async function rememberVerificationEmail(email: string) {
  const cookieStore = await cookies();
  cookieStore.set(EMAIL_VERIFICATION_COOKIE, email, {
    httpOnly: true,
    maxAge: EMAIL_VERIFICATION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  });
}

async function getRememberedVerificationEmail() {
  const cookieStore = await cookies();
  return normalizeEmailAddress(
    cookieStore.get(EMAIL_VERIFICATION_COOKIE)?.value,
  );
}

async function clearRememberedVerificationEmail() {
  const cookieStore = await cookies();
  cookieStore.delete(EMAIL_VERIFICATION_COOKIE);
}

function loginError(message: string): never {
  redirect(`/login?error=${encodeURIComponent(message)}`);
}

function registerError(message: string): never {
  redirect(`/register?error=${encodeURIComponent(message)}`);
}

function verificationError(message: string): never {
  redirect(
    `/login?verification=required&error=${encodeURIComponent(message)}`,
  );
}

function verificationCodeError(message: string): never {
  redirect(
    `/login?verification=code&error=${encodeURIComponent(message)}`,
  );
}

export async function signIn(formData: FormData) {
  if (!isLiveMode()) redirect("/home");

  const email = normalizeEmailAddress(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const allowed = getAllowlistEmails();

  if (!email || !password) loginError("请填写邮箱和密码");
  if (!allowed.includes(email)) {
    loginError("这个邮箱不在小星球的访客名单里");
  }
  if (!isNeonConfigured()) {
    loginError("Neon Auth 尚未完成配置");
  }

  const { data, error } = await getAuth().signIn.email({ email, password });
  if (error) loginError("登录失败，请检查邮箱或密码");
  // Neon Auth writes the new session cookie during this action. Reading the
  // session again here would still see the incoming request's old cookies,
  // so initialize the one-time profile from the sign-in response directly.
  if (!data?.user) loginError("登录状态未能完成初始化，请重试。");
  if (!emailIsVerified(data.user)) {
    await rememberVerificationEmail(email);
    redirect("/login?verification=required");
  }
  await ensureProfile(data.user);
  redirect("/home");
}

export async function signOut() {
  if (isLiveMode() && isNeonConfigured()) {
    await getAuth().signOut();
  }
  await clearRememberedVerificationEmail();
  redirect("/login");
}

export async function resendVerificationEmail(formData: FormData) {
  if (!isLiveMode() || !isNeonConfigured()) {
    verificationError("Neon Auth 尚未完成配置");
  }

  const email = normalizeEmailAddress(formData.get("email"));
  if (!email || !getAllowlistEmails().includes(email)) {
    verificationError("请填写已经注册的白名单邮箱");
  }

  const { error } = await getAuth().sendVerificationEmail({
    email,
  });
  if (error) verificationError("验证邮件发送失败，请稍后重试");
  await rememberVerificationEmail(email);
  redirect("/login?verification=code&verificationSent=1");
}

export async function verifyEmailCode(formData: FormData) {
  if (!isLiveMode() || !isNeonConfigured()) {
    verificationCodeError("Neon Auth 尚未完成配置");
  }

  const email = await getRememberedVerificationEmail();
  const otp = normalizeEmailVerificationCode(formData.get("otp"));
  if (!email || !getAllowlistEmails().includes(email)) {
    verificationCodeError("验证已过期，请重新发送验证码");
  }
  if (!otp) {
    verificationCodeError("请输入邮件中的 6 位数字验证码");
  }

  // Neon Auth exposes the email-otp plugin at runtime, but the current server
  // wrapper leaves plugin-specific methods typed as unknown.
  const emailOtp = getAuth().emailOtp as EmailOtpVerificationClient;
  let error: unknown;
  try {
    ({ error } = await emailOtp.verifyEmail({ email, otp }));
  } catch {
    verificationCodeError("验证码验证失败，请稍后重试");
  }
  if (error) {
    verificationCodeError("验证码无效或已过期，请重新发送后再试");
  }
  await clearRememberedVerificationEmail();
  redirect("/login?verified=1");
}

export async function signUp(formData: FormData) {
  if (!isLiveMode() || !isNeonConfigured()) {
    registerError("请先完成 Neon Auth 配置并切换到 live 模式");
  }

  const email = normalizeEmailAddress(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!email || !password || !name) registerError("请填写完整注册信息");
  if (!getAllowlistEmails().includes(email)) {
    registerError("这个邮箱不在小星球的双人白名单里");
  }
  const { error } = await getAuth().signUp.email({ email, password, name });
  if (error) {
    registerError("注册未完成；如果邮箱已注册，请返回登录并重新发送验证邮件");
  }
  await rememberVerificationEmail(email);
  redirect("/login?registered=1&verification=code");
}
