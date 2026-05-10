import { SPOTIFY_OAUTH_STATE_COOKIE } from "@/lib/session";

/** Parse Cookie request header (fallback if next/headers cookies() misses values). */
export function readCookieFromHeader(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  const prefix = `${name}=`;
  for (const part of parts) {
    if (part.startsWith(prefix)) {
      const raw = part.slice(prefix.length);
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return undefined;
}

export function buildOauthStateSetCookieHeader(state: string): string {
  const secure = process.env.NODE_ENV === "production";
  const value = encodeURIComponent(state);
  return [
    `${SPOTIFY_OAUTH_STATE_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=600",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function buildClearOauthStateSetCookieHeader(): string {
  const secure = process.env.NODE_ENV === "production";
  return [
    `${SPOTIFY_OAUTH_STATE_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
