export type EmailVerificationUser = {
  emailVerified?: boolean | null;
};

export function normalizeEmailAddress(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function emailIsVerified(
  user?: EmailVerificationUser | null,
) {
  return user?.emailVerified === true;
}
