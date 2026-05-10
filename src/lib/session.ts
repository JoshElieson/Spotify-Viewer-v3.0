import type { SessionOptions } from "iron-session";

export const SESSION_COOKIE_NAME = "spotify_viewer_session";

/** CSRF state for Spotify OAuth; must be Set-Cookie on the redirect response (iron-session save can miss that merge). */
export const SPOTIFY_OAUTH_STATE_COOKIE = "spotify_oauth_state";

export interface SpotifySessionUser {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix ms
}

export interface AppSessionData {
  spotify?: SpotifySessionUser;
}

export function getSessionOptions(): SessionOptions {
  const password = process.env.SESSION_PASSWORD;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_PASSWORD must be set and at least 32 characters long.",
    );
  }

  return {
    password,
    cookieName: SESSION_COOKIE_NAME,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 60, // 60 days
    },
  };
}
