"use server";

import { redirect } from "next/navigation";
import { ensureProfile } from "@/lib/auth/profile";
import { getAuth } from "@/lib/auth/server";
import {
  emailIsVerified,
  normalizeEmailAddress,
} from "@/lib/auth/verification";
import {
  getAllowlistEmails,
  isLiveMode,
  isNeonConfigured,
} from "@/lib/config/backend";

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
    redirect("/login?verification=required");
  }
  await ensureProfile(data.user);
  redirect("/home");
}

export async function signOut() {
  if (isLiveMode() && isNeonConfigured()) {
    await getAuth().signOut();
  }
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
    callbackURL: "/login?verified=1",
  });
  if (error) verificationError("验证邮件发送失败，请稍后重试");
  redirect("/login?verificationSent=1");
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
  redirect("/login?registered=1");
}
