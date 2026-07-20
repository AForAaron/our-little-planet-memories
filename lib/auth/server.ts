import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  getAllowlistEmails,
  isLiveMode,
  isNeonConfigured,
} from "@/lib/config/backend";

function createAuth() {
  if (!isNeonConfigured()) {
    throw new Error("Neon Auth 尚未配置。请填写 NEON_AUTH_BASE_URL 和 Cookie Secret。");
  }

  return createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookies: {
      secret: process.env.NEON_AUTH_COOKIE_SECRET!,
      sameSite: "strict",
    },
  });
}

let authInstance: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  authInstance ??= createAuth();
  return authInstance;
}

export function emailIsAllowlisted(email?: string | null) {
  return Boolean(email && getAllowlistEmails().includes(email.toLowerCase()));
}

export function emailIsVerified(
  user?: { emailVerified?: boolean | null } | null,
) {
  return user?.emailVerified === true;
}

export const getCoupleUser = cache(async () => {
  if (!isLiveMode()) return null;
  const { data: session } = await getAuth().getSession();
  const user = session?.user;
  return user && emailIsVerified(user) && emailIsAllowlisted(user.email)
    ? user
    : null;
});

export async function assertCoupleUser() {
  const user = await getCoupleUser();
  if (!user) {
    throw new Error("请使用已验证的白名单邮箱重新登录。");
  }
  return user;
}

export async function requireCoupleUser() {
  const user = await getCoupleUser();
  if (!user) redirect("/login");
  return user;
}
