import { NextResponse } from "next/server";
import {
  SPOTIFY_AUTH_BASE,
  SPOTIFY_SCOPES,
  getAppOrigin,
  getSpotifyOAuthRedirectUri,
} from "@/lib/spotify-config";
import { buildOauthStateSetCookieHeader } from "@/lib/oauth-helpers";
import {
  appAndRequestOriginsMatch,
  getInboundOrigin,
  loopbackAlignRedirectUrl,
} from "@/lib/request-origin";

function wrongOriginPage(requestOrigin: string, appOrigin: string): Response {
  const body = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Use configured URL</title></head><body style="font-family:system-ui,sans-serif;max-width:36rem;margin:2rem;line-height:1.5">` +
    `<h1 style="font-size:1.25rem">Start login from your configured app URL</h1>` +
    `<p>This app is wired to <strong><a href="${appOrigin}/">${appOrigin}</a></strong> (<code>NEXT_PUBLIC_APP_URL</code>).</p>` +
    `<p>Your request looked like <code>${requestOrigin}</code> — that does not match this app (different host or port).</p>` +
    `<p><a href="${appOrigin}/">Open ${appOrigin}</a> (then click Continue with Spotify).</p>` +
    `<p style="color:#555;font-size:0.9rem">Or change <code>NEXT_PUBLIC_APP_URL</code> in <code>.env.local</code> and add the matching callback in the Spotify dashboard.</p>` +
    `</body></html>`;
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    return new Response("SPOTIFY_CLIENT_ID is not configured.", { status: 500 });
  }

  let appOrigin: string;
  try {
    appOrigin = getAppOrigin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Missing NEXT_PUBLIC_APP_URL";
    return new Response(msg, { status: 500 });
  }

  const align = loopbackAlignRedirectUrl(request, appOrigin);
  if (align) {
    return NextResponse.redirect(align);
  }

  const inbound = getInboundOrigin(request);
  if (!appAndRequestOriginsMatch(inbound, appOrigin)) {
    return wrongOriginPage(inbound, appOrigin);
  }

  const state = crypto.randomUUID();
  const redirectUri = getSpotifyOAuthRedirectUri();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES,
    state,
  });

  const authorizeUrl = `${SPOTIFY_AUTH_BASE}/authorize?${params.toString()}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl,
      "Set-Cookie": buildOauthStateSetCookieHeader(state),
    },
  });
}
