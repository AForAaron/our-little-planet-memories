import "server-only";

import { cookies } from "next/headers";
import {
  CLOUDBASE_SESSION_COOKIE,
  getAuthProvider,
  isCloudBaseAuthConfigured,
} from "@/lib/auth/cloudbase-shared";

export type CloudBaseAuthUser = {
  id: string;
  email?: string | null;
  emailVerified?: boolean | null;
  name?: string | null;
};

export {
  CLOUDBASE_SESSION_COOKIE,
  getAuthProvider,
  isCloudBaseAuthConfigured,
};

const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function authBaseUrl() {
  const envId = process.env.CLOUDBASE_ENV_ID?.trim();
  if (!envId) {
    throw new Error("CLOUDBASE_ENV_ID 未配置");
  }
  return `https://${envId}.api.tcloudbasegateway.com/auth`;
}

function deviceId() {
  return process.env.CLOUDBASE_AUTH_DEVICE_ID?.trim() || "little-planet-web";
}

type SignInResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  sub?: string;
  code?: string;
  error?: string;
  error_description?: string;
};

type UserMeResponse = {
  sub?: string;
  user_id?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  username?: string;
  status?: string;
  type?: string;
};

async function authFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("x-device-id", deviceId());
  return fetch(`${authBaseUrl()}${path}`, { ...init, headers });
}

export async function setCloudBaseSessionCookie(
  accessToken: string,
  maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS,
) {
  const cookieStore = await cookies();
  cookieStore.set(CLOUDBASE_SESSION_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function clearCloudBaseSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(CLOUDBASE_SESSION_COOKIE);
}

export async function getCloudBaseAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get(CLOUDBASE_SESSION_COOKIE)?.value ?? null;
}

export async function signInWithCloudBaseEmail(input: {
  email: string;
  password: string;
}) {
  if (!isCloudBaseAuthConfigured()) {
    throw new Error(
      "CloudBase Auth 尚未启用。请设置 CLOUDBASE_ENV_ID 与 CLOUDBASE_AUTH_ENABLED=1。",
    );
  }

  const res = await authFetch("/v1/signin", {
    method: "POST",
    body: JSON.stringify({
      username: input.email,
      password: input.password,
    }),
  });
  const data = (await res.json()) as SignInResponse;
  if (!res.ok || !data.access_token) {
    return {
      ok: false as const,
      error: data.error_description || data.error || data.code || "signin_failed",
    };
  }

  await setCloudBaseSessionCookie(
    data.access_token,
    typeof data.expires_in === "number" && data.expires_in > 0
      ? data.expires_in
      : DEFAULT_MAX_AGE_SECONDS,
  );

  const user = await fetchCloudBaseUser(data.access_token);
  return { ok: true as const, user, sub: data.sub ?? user?.id ?? null };
}

export async function signOutCloudBase() {
  const token = await getCloudBaseAccessToken();
  if (token) {
    try {
      await authFetch("/v1/user/signout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: "{}",
      });
    } catch {
      // Best-effort revoke; always clear local cookie.
    }
  }
  await clearCloudBaseSessionCookie();
}

async function fetchCloudBaseUser(
  accessToken: string,
): Promise<CloudBaseAuthUser | null> {
  const res = await authFetch("/v1/user/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const me = (await res.json()) as UserMeResponse;
  const id = me.sub || me.user_id;
  if (!id) return null;

  // Admin-provisioned ACTIVE users may omit email_verified; treat them as
  // verified when they have an email. Unverified self-signups still fail.
  const emailVerified =
    me.email_verified === true ||
    (me.status === "ACTIVE" && Boolean(me.email));

  return {
    id,
    email: me.email ?? null,
    emailVerified,
    name: me.name || me.username || null,
  };
}

/**
 * Resolve the current CloudBase Auth user from the session cookie.
 */
export async function getCloudBaseSessionUser(): Promise<CloudBaseAuthUser | null> {
  if (!isCloudBaseAuthConfigured()) {
    throw new Error(
      "CloudBase Auth 尚未启用。请在控制台开通邮箱登录并设置 CLOUDBASE_ENV_ID 与 CLOUDBASE_AUTH_ENABLED=1。",
    );
  }

  const token = await getCloudBaseAccessToken();
  if (!token) return null;
  return fetchCloudBaseUser(token);
}
