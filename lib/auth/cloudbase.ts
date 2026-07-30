import "server-only";

/**
 * CloudBase Auth adapter scaffold (M4).
 *
 * Production cutover keeps AUTH_PROVIDER=neon until CloudBase email login,
 * cookie/session behavior, and UID→profiles.id mapping are accepted on the
 * CloudBase Run test domain. Do not overwrite profiles.id with CloudBase UIDs.
 */

export type CloudBaseAuthUser = {
  id: string;
  email?: string | null;
  emailVerified?: boolean | null;
};

export function isCloudBaseAuthConfigured() {
  return Boolean(
    process.env.CLOUDBASE_ENV_ID &&
      process.env.CLOUDBASE_AUTH_ENABLED === "1",
  );
}

export function getAuthProvider(): "neon" | "cloudbase" {
  const value = process.env.AUTH_PROVIDER?.trim().toLowerCase();
  if (value === "cloudbase") return "cloudbase";
  return "neon";
}

/**
 * Placeholder for CloudBase session resolution.
 * Wired in M4 after console Auth is enabled; throws until then so misconfig fails loud.
 */
export async function getCloudBaseSessionUser(): Promise<CloudBaseAuthUser | null> {
  if (!isCloudBaseAuthConfigured()) {
    throw new Error(
      "CloudBase Auth 尚未启用。请在控制台开通邮箱登录并设置 CLOUDBASE_ENV_ID 与 CLOUDBASE_AUTH_ENABLED=1。",
    );
  }
  throw new Error(
    "CloudBase Auth 会话解析尚未在本环境接通；请保持 AUTH_PROVIDER=neon 直到 M4 验收通过。",
  );
}
