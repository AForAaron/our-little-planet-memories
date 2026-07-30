/** Prefer gateway-facing host when behind CloudBase Run / reverse proxies. */
export function resolvePublicRequestOrigin({
  requestUrl,
  host,
  forwardedHost,
  forwardedProto,
}: {
  requestUrl: string;
  host: string | null;
  forwardedHost: string | null;
  forwardedProto: string | null;
}) {
  const url = new URL(requestUrl);
  const publicHost =
    firstHeaderValue(forwardedHost) || firstHeaderValue(host) || url.host;
  const proto =
    firstHeaderValue(forwardedProto) ||
    (url.protocol === "https:" ? "https" : "http");
  return `${proto}://${publicHost}`;
}

export function isTrustedSameOriginRequest({
  requestUrl,
  origin,
  fetchSite,
  host = null,
  forwardedHost = null,
  forwardedProto = null,
}: {
  requestUrl: string;
  origin: string | null;
  fetchSite: string | null;
  host?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
}) {
  if (!origin || fetchSite === "cross-site") return false;
  try {
    const expected = resolvePublicRequestOrigin({
      requestUrl,
      host,
      forwardedHost,
      forwardedProto,
    });
    return new URL(origin).origin === new URL(expected).origin;
  } catch {
    return false;
  }
}

function firstHeaderValue(value: string | null) {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}
