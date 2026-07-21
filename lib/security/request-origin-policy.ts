export function isTrustedSameOriginRequest({
  requestUrl,
  origin,
  fetchSite,
}: {
  requestUrl: string;
  origin: string | null;
  fetchSite: string | null;
}) {
  if (!origin || fetchSite === "cross-site") return false;
  try {
    return new URL(origin).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}
