export type EmailVerificationUser = {
  emailVerified?: boolean | null;
};

export function normalizeEmailAddress(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function normalizeEmailVerificationCode(value: unknown) {
  const code = typeof value === "string" ? value.trim() : "";
  return /^\d{6}$/.test(code) ? code : "";
}

export function emailIsVerified(
  user?: EmailVerificationUser | null,
) {
  return user?.emailVerified === true;
}
