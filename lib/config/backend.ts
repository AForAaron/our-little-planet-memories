export type AppDataMode = "demo" | "live";

export function getAppDataMode(): AppDataMode {
  return process.env.APP_DATA_MODE === "live" ? "live" : "demo";
}

export function isLiveMode() {
  return getAppDataMode() === "live";
}

export function isNeonConfigured() {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.NEON_AUTH_BASE_URL &&
      process.env.NEON_AUTH_COOKIE_SECRET &&
      process.env.NEON_AUTH_COOKIE_SECRET.length >= 32,
  );
}

export function isR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

export function getAllowlistEmails() {
  return (process.env.ALLOWLIST_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function assertLiveBackendConfigured() {
  if (!isLiveMode()) return;

  const allowlistEmails = getAllowlistEmails();

  const missing = [
    !process.env.DATABASE_URL && "DATABASE_URL",
    !process.env.NEON_AUTH_BASE_URL && "NEON_AUTH_BASE_URL",
    (!process.env.NEON_AUTH_COOKIE_SECRET ||
      process.env.NEON_AUTH_COOKIE_SECRET.length < 32) &&
      "NEON_AUTH_COOKIE_SECRET (至少 32 字符)",
    !process.env.R2_ACCOUNT_ID && "R2_ACCOUNT_ID",
    !process.env.R2_ACCESS_KEY_ID && "R2_ACCESS_KEY_ID",
    !process.env.R2_SECRET_ACCESS_KEY && "R2_SECRET_ACCESS_KEY",
    !process.env.R2_BUCKET && "R2_BUCKET",
    (allowlistEmails.length !== 2 || new Set(allowlistEmails).size !== 2) &&
      "ALLOWLIST_EMAILS (必须是两个不同邮箱)",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`live 模式缺少配置：${missing.join("、")}`);
  }
}
