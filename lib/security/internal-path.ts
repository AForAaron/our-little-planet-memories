/**
 * Keeps persisted navigation values relative to this application. Browser URL
 * parsing treats a leading double slash or backslash as an external origin.
 */
export function normalizeInternalPath(value: unknown): string | null;
export function normalizeInternalPath(value: unknown, fallback: string): string;
export function normalizeInternalPath(
  value: unknown,
  fallback: string | null = null,
): string | null {
  const path = typeof value === "string" ? value.trim().slice(0, 500) : "";
  if (
    !path ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(path)
  ) {
    return fallback;
  }

  const fragmentIndex = path.indexOf("#");
  return fragmentIndex >= 0 ? path.slice(0, fragmentIndex) || fallback : path;
}
