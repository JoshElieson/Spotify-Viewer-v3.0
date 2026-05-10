import { NextResponse } from "next/server";
import {
  MAX_TOP_LIMIT,
  MIN_TOP_LIMIT,
} from "@/lib/spotify-config";
import { getAppSession, spotifyApi } from "@/lib/spotify-server";
import type { SpotifyPlayHistoryItem } from "@/lib/spotify-types";

function parseLimit(v: string | null): number {
  const n = v ? Number.parseInt(v, 10) : NaN;
  if (Number.isFinite(n)) {
    return Math.min(MAX_TOP_LIMIT, Math.max(MIN_TOP_LIMIT, n));
  }
  return 20;
}

type RecentPage = {
  items: SpotifyPlayHistoryItem[];
  next: string | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams.get("limit"));

  try {
    const session = await getAppSession();
    if (!session.spotify) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const items: SpotifyPlayHistoryItem[] = [];
    let nextUrl: string | null = `/me/player/recently-played?limit=${Math.min(50, limit)}`;

    while (nextUrl && items.length < limit) {
      const page: RecentPage = await spotifyApi<RecentPage>(nextUrl);
      for (const row of page.items) {
        if (items.length >= limit) break;
        items.push(row);
      }
      if (items.length >= limit) break;
      nextUrl = page.next;
    }

    return NextResponse.json({
      items: items.slice(0, limit),
      limit,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
