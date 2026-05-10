/**
 * Next.js dev (and some proxies) can set `request.url` to http://localhost:... even when
 * the browser opened http://127.0.0.1:.... The Host header reflects what the client used.
 */
export function getInboundOrigin(request: Request): string {
  const parsed = new URL(request.url);
  const host = request.headers.get("host")?.trim();
  if (host) {
    return `${parsed.protocol}//${host}`;
  }
  return parsed.origin;
}

/** Same machine loopback — treat as one origin (same port). */
export function loopbackCanonicalOrigin(origin: string): string | null {
  try {
    const u = new URL(origin);
    const h = u.hostname.toLowerCase();
    if (
      h === "localhost" ||
      h === "127.0.0.1" ||
      h === "::1" ||
      h === "[::1]"
    ) {
      u.hostname = "127.0.0.1";
      return u.origin;
    }
    return null;
  } catch {
    return null;
  }
}

export function appAndRequestOriginsMatch(
  requestOrigin: string,
  appOrigin: string,
): boolean {
  const a = loopbackCanonicalOrigin(requestOrigin);
  const b = loopbackCanonicalOrigin(appOrigin);
  if (a !== null && b !== null) {
    return a === b;
  }
  return requestOrigin === appOrigin;
}

/**
 * When config says 127.0.0.1 but the client hit localhost (or vice versa), one 302 to the
 * configured origin aligns cookies with Spotify's redirect_uri. Returns null if no redirect.
 */
export function loopbackAlignRedirectUrl(
  request: Request,
  appOrigin: string,
): string | null {
  const inbound = getInboundOrigin(request);
  if (!appAndRequestOriginsMatch(inbound, appOrigin)) {
    return null;
  }
  if (inbound === appOrigin) {
    return null;
  }
  const target = new URL(request.url);
  const app = new URL(`${appOrigin.replace(/\/$/, "")}/`);
  target.protocol = app.protocol;
  target.hostname = app.hostname;
  target.port = app.port;
  return target.toString();
}
