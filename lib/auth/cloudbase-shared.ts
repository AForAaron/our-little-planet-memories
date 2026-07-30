/**
 * Shared CloudBase Auth constants / env checks (safe for proxy/middleware).
 * Session HTTP helpers stay in cloudbase.ts (server-only).
 */

export const CLOUDBASE_SESSION_COOKIE = "planet_cloudbase_session";

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
