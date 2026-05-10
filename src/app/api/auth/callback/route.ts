import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { AppSessionData } from "@/lib/session";
import { SPOTIFY_OAUTH_STATE_COOKIE, getSessionOptions } from "@/lib/session";
import {
  buildClearOauthStateSetCookieHeader,
  readCookieFromHeader,
} from "@/lib/oauth-helpers";
import { exchangeCodeForTokens } from "@/lib/spotify-server";
import {
  getAppHomeUrl,
  getAppOrigin,
  getSpotifyOAuthRedirectUri,
} from "@/lib/spotify-config";
import {
  appAndRequestOriginsMatch,
  getInboundOrigin,
} from "@/lib/request-origin";

function redirectToApp(pathWithQuery: string): Response {
  const location = new URL(pathWithQuery, getAppHomeUrl()).toString();
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Set-Cookie": buildClearOauthStateSetCookieHeader(),
    },
  });
}

export async function GET(request: Request) {
  let appOrigin: string;
  try {
    appOrigin = getAppOrigin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Missing NEXT_PUBLIC_APP_URL";
    return new Response(msg, { status: 500 });
  }

  const inbound = getInboundOrigin(request);
  if (!appAndRequestOriginsMatch(inbound, appOrigin)) {
    return new Response(
      `OAuth callback origin (${inbound}) does not match NEXT_PUBLIC_APP_URL (${appOrigin}). Fix .env and Spotify redirect URIs.`,
      { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const err = searchParams.get("error");

  if (err) {
    return redirectToApp(`/?error=${encodeURIComponent(err)}`);
  }

  if (!code || !state) {
    return redirectToApp("/?error=missing_code_or_state");
  }

  const cookieStore = await cookies();
  const stored =
    cookieStore.get(SPOTIFY_OAUTH_STATE_COOKIE)?.value ??
    readCookieFromHeader(
      request.headers.get("cookie"),
      SPOTIFY_OAUTH_STATE_COOKIE,
    );

  if (!stored || stored !== state) {
    return redirectToApp("/?error=invalid_state");
  }

  const session = await getIronSession<AppSessionData>(
    await cookies(),
    getSessionOptions(),
  );

  try {
    session.spotify = await exchangeCodeForTokens(
      code,
      getSpotifyOAuthRedirectUri(),
    );
    await session.save();
  } catch {
    return redirectToApp("/?error=token_exchange_failed");
  }

  const res = NextResponse.redirect(getAppHomeUrl());
  res.cookies.set(SPOTIFY_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
