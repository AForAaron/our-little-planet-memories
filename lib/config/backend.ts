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

function isS3CompatibleConfigured() {
  return Boolean(
    process.env.S3_ENDPOINT &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY &&
      process.env.S3_BUCKET,
  );
}

function isClassicR2Configured() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET,
  );
}

export function isObjectStorageConfigured() {
  const provider = process.env.STORAGE_PROVIDER?.trim().toLowerCase();
  if (provider === "s3" || provider === "cos" || provider === "cloudbase") {
    return isS3CompatibleConfigured();
  }
  if (provider === "r2") return isClassicR2Configured();
  return isClassicR2Configured() || isS3CompatibleConfigured();
}

export function isCloudBaseLiveConfigured() {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.AUTH_PROVIDER === "cloudbase" &&
      process.env.CLOUDBASE_ENV_ID &&
      process.env.CLOUDBASE_AUTH_ENABLED === "1" &&
      isObjectStorageConfigured(),
  );
}

/** True when live mode has a complete backend (Neon path or CloudBase path). */
export function isLiveBackendReady() {
  if (process.env.AUTH_PROVIDER === "cloudbase") {
    return isCloudBaseLiveConfigured();
  }
  return isNeonConfigured() && isR2Configured();
}

export function isR2Configured() {
  return isObjectStorageConfigured();
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
  const usingCloudBase = process.env.AUTH_PROVIDER === "cloudbase";

  const missing = usingCloudBase
    ? [
        !process.env.DATABASE_URL && "DATABASE_URL",
        !process.env.CLOUDBASE_ENV_ID && "CLOUDBASE_ENV_ID",
        process.env.CLOUDBASE_AUTH_ENABLED !== "1" && "CLOUDBASE_AUTH_ENABLED=1",
        !isObjectStorageConfigured() &&
          "STORAGE_PROVIDER=s3 及相关 S3_*（或仍用 R2_*）",
        (allowlistEmails.length !== 2 || new Set(allowlistEmails).size !== 2) &&
          "ALLOWLIST_EMAILS (必须是两个不同邮箱)",
      ]
    : [
        !process.env.DATABASE_URL && "DATABASE_URL",
        !process.env.NEON_AUTH_BASE_URL && "NEON_AUTH_BASE_URL",
        (!process.env.NEON_AUTH_COOKIE_SECRET ||
          process.env.NEON_AUTH_COOKIE_SECRET.length < 32) &&
          "NEON_AUTH_COOKIE_SECRET (至少 32 字符)",
        !isObjectStorageConfigured() && "对象存储配置不完整（R2_* 或 S3_*）",
        (allowlistEmails.length !== 2 || new Set(allowlistEmails).size !== 2) &&
          "ALLOWLIST_EMAILS (必须是两个不同邮箱)",
      ];

  const filtered = missing.filter(Boolean);
  if (filtered.length) {
    throw new Error(`live 模式缺少配置：${filtered.join("、")}`);
  }
}
