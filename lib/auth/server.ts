import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  getAllowlistEmails,
  isLiveMode,
  isNeonConfigured,
} from "@/lib/config/backend";
import {
  getAuthProvider,
  getCloudBaseSessionUser,
  isCloudBaseAuthConfigured,
} from "@/lib/auth/cloudbase";
import { findProfileIdByAuthIdentity } from "@/lib/auth/identity-map";
import { emailIsVerified } from "@/lib/auth/verification";

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
  if (getAuthProvider() === "cloudbase") {
    throw new Error(
      "当前 AUTH_PROVIDER=cloudbase，请勿调用 Neon getAuth()。会话请走 CloudBase Auth 适配层。",
    );
  }
  authInstance ??= createAuth();
  return authInstance;
}

export function emailIsAllowlisted(email?: string | null) {
  return Boolean(email && getAllowlistEmails().includes(email.toLowerCase()));
}

export type CoupleUser = {
  id: string;
  email?: string | null;
  emailVerified?: boolean | null;
  name?: string | null;
  profileId?: string;
};

export const getCoupleUser = cache(async (): Promise<CoupleUser | null> => {
  if (!isLiveMode()) return null;

  if (getAuthProvider() === "cloudbase") {
    if (!isCloudBaseAuthConfigured()) return null;
    const user = await getCloudBaseSessionUser();
    if (!user || !emailIsVerified(user) || !emailIsAllowlisted(user.email)) {
      return null;
    }
    const profileId = await findProfileIdByAuthIdentity("cloudbase", user.id);
    if (!profileId) {
      // Mapping missing: reject rather than invent or overwrite profiles.id.
      return null;
    }
    // Call sites treat user.id as profiles.id (Neon Auth historically used the same UUID).
    return {
      id: profileId,
      email: user.email,
      emailVerified: user.emailVerified,
      profileId,
    };
  }

  const { data: session } = await getAuth().getSession();
  const user = session?.user;
  if (!user || !emailIsVerified(user) || !emailIsAllowlisted(user.email)) {
    return null;
  }
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: "name" in user ? (user as { name?: string | null }).name : null,
  };
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
