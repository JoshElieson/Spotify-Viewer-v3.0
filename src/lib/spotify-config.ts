export const SPOTIFY_AUTH_BASE = "https://accounts.spotify.com";
export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

/** Spotify Web API time_range for top artists/tracks */
export const TIME_RANGES = ["short_term", "medium_term", "long_term"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  short_term: "Last 4 weeks",
  medium_term: "Last 6 months",
  long_term: "All time",
};

export const DEFAULT_TOP_LIMIT = 20;
export const MIN_TOP_LIMIT = 5;
/** UI + server cap; top artists/tracks use two Spotify requests (50+50); recent uses cursor pages. */
export const MAX_TOP_LIMIT = 100;

export const SPOTIFY_SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-top-read",
  "user-read-recently-played",
  "playlist-read-private",
  "user-follow-read",
].join(" ");

/**
 * Single canonical origin for this deployment (no trailing slash).
 * Every OAuth Location header uses this — never `new URL(..., request.url)` — so we never
 * ping-pong between localhost, 127.0.0.1, or proxy hosts.
 */
export function getAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    return `https://${vercel.replace(/\/$/, "")}`;
  }
  throw new Error(
    "Set NEXT_PUBLIC_APP_URL in .env.local (e.g. http://127.0.0.1:3000 for local Spotify OAuth).",
  );
}

/** Exact `redirect_uri` sent to Spotify; must match the Spotify dashboard entry. */
export function getSpotifyOAuthRedirectUri(): string {
  const explicit = process.env.SPOTIFY_REDIRECT_URI?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  return `${getAppOrigin()}/api/auth/callback`;
}

/** Home page URL for safe redirects after auth. */
export function getAppHomeUrl(): string {
  return `${getAppOrigin()}/`;
}
