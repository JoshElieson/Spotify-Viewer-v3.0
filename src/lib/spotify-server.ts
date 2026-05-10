import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import type { AppSessionData, SpotifySessionUser } from "@/lib/session";
import { getSessionOptions } from "@/lib/session";
import { SPOTIFY_API_BASE, SPOTIFY_AUTH_BASE } from "@/lib/spotify-config";
import type { SpotifyMeWithCounts, SpotifyUser } from "@/lib/spotify-types";

function getClientCredentials(): { id: string; secret: string } {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set.");
  }
  return { id, secret };
}

export async function getAppSession() {
  return getIronSession<AppSessionData>(await cookies(), getSessionOptions());
}

async function persistSpotifyUser(user: SpotifySessionUser) {
  const session = await getAppSession();
  session.spotify = user;
  await session.save();
}

async function refreshAccessToken(refreshToken: string): Promise<SpotifySessionUser> {
  const { id, secret } = getClientCredentials();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: id,
    client_secret: secret,
  });

  const res = await fetch(`${SPOTIFY_AUTH_BASE}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const expiresAt = Date.now() + json.expires_in * 1000 - 30_000;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? refreshToken,
    expiresAt,
  };
}

/** Ensures a valid access token; refreshes and updates the session cookie when needed. */
export async function getValidSpotifyUser(): Promise<SpotifySessionUser> {
  const session = await getAppSession();
  const user = session.spotify;
  if (!user) {
    throw new Error("Not authenticated with Spotify.");
  }

  if (Date.now() < user.expiresAt) {
    return user;
  }

  const refreshed = await refreshAccessToken(user.refreshToken);
  await persistSpotifyUser(refreshed);
  return refreshed;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<SpotifySessionUser> {
  const { id, secret } = getClientCredentials();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: id,
    client_secret: secret,
  });

  const res = await fetch(`${SPOTIFY_AUTH_BASE}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const expiresAt = Date.now() + json.expires_in * 1000 - 30_000;
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt,
  };
}

export async function spotifyApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const user = await getValidSpotifyUser();
  const url = path.startsWith("http") ? path : `${SPOTIFY_API_BASE}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (res.status === 401) {
    const refreshed = await refreshAccessToken(user.refreshToken);
    await persistSpotifyUser(refreshed);
    const retry = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${refreshed.accessToken}`,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!retry.ok) {
      const text = await retry.text();
      throw new Error(`Spotify API error: ${retry.status} ${text}`);
    }
    return (await retry.json()) as T;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Spotify API error: ${res.status} ${text}`);
  }

  return (await res.json()) as T;
}

/** Current user plus followed-artist count and owned/saved playlist count (minimal extra requests). */
export async function fetchSpotifyMeWithCounts(): Promise<SpotifyMeWithCounts> {
  const me = await spotifyApi<SpotifyUser>("/me");
  const [followingResult, playlistsResult] = await Promise.allSettled([
    spotifyApi<{ artists: { total: number } }>(
      "/me/following?type=artist&limit=1",
    ),
    spotifyApi<{ total: number }>("/me/playlists?limit=1"),
  ]);
  return {
    ...me,
    following_total:
      followingResult.status === "fulfilled"
        ? followingResult.value.artists.total
        : null,
    playlists_total:
      playlistsResult.status === "fulfilled"
        ? playlistsResult.value.total
        : null,
  };
}
