/** Prefer gateway-facing host when behind CloudBase Run / reverse proxies. */
export function resolvePublicRequestHost({
  requestUrl,
  host,
  forwardedHost,
}: {
  requestUrl: string;
  host: string | null;
  forwardedHost: string | null;
}) {
  const url = new URL(requestUrl);
  return (
    firstHeaderValue(forwardedHost) || firstHeaderValue(host) || url.host
  );
}

/** @deprecated Prefer resolvePublicRequestHost; kept for call-site clarity in tests. */
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
  const publicHost = resolvePublicRequestHost({
    requestUrl,
    host,
    forwardedHost,
  });
  const url = new URL(requestUrl);
  const proto =
    firstHeaderValue(forwardedProto) ||
    (url.protocol === "https:" ? "https" : null) ||
    (isLoopbackHost(publicHost) ? "http" : "https");
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
    // Compare host only: CloudBase often presents http request.url while the
    // browser Origin is https, and X-Forwarded-Proto may be absent.
    const publicHost = resolvePublicRequestHost({
      requestUrl,
      host,
      forwardedHost,
    });
    void forwardedProto;
    return new URL(origin).host === publicHost;
  } catch {
    return false;
  }
}

function firstHeaderValue(value: string | null) {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function isLoopbackHost(host: string) {
  const name = host.split(":")[0]?.toLowerCase() ?? "";
  return name === "localhost" || name === "127.0.0.1" || name === "::1";
}
