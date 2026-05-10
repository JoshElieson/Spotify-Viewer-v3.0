import { NextResponse } from "next/server";
import {
  MAX_TOP_LIMIT,
  MIN_TOP_LIMIT,
  TIME_RANGES,
  type TimeRange,
} from "@/lib/spotify-config";
import { getAppSession, spotifyApi } from "@/lib/spotify-server";
import type { SpotifyArtist } from "@/lib/spotify-types";

function parseTimeRange(v: string | null): TimeRange {
  if (v && (TIME_RANGES as readonly string[]).includes(v)) {
    return v as TimeRange;
  }
  return "medium_term";
}

function parseLimit(v: string | null): number {
  const n = v ? Number.parseInt(v, 10) : NaN;
  if (Number.isFinite(n)) {
    return Math.min(MAX_TOP_LIMIT, Math.max(MIN_TOP_LIMIT, n));
  }
  return 20;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const timeRange = parseTimeRange(searchParams.get("time_range"));
  const limit = parseLimit(searchParams.get("limit"));

  try {
    const session = await getAppSession();
    if (!session.spotify) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let items: SpotifyArtist[];
    if (limit <= 50) {
      const data = await spotifyApi<{ items: SpotifyArtist[] }>(
        `/me/top/artists?time_range=${timeRange}&limit=${limit}`,
      );
      items = data.items;
    } else {
      const first = await spotifyApi<{ items: SpotifyArtist[] }>(
        `/me/top/artists?time_range=${timeRange}&limit=50&offset=0`,
      );
      const second = await spotifyApi<{ items: SpotifyArtist[] }>(
        `/me/top/artists?time_range=${timeRange}&limit=${limit - 50}&offset=50`,
      );
      items = [...first.items, ...second.items].slice(0, limit);
    }
    return NextResponse.json({ items, time_range: timeRange, limit });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
