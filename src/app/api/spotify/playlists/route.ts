import { NextResponse } from "next/server";
import { getAppSession, spotifyApi } from "@/lib/spotify-server";
import type { SpotifyPlaylist } from "@/lib/spotify-types";

type PlaylistPage = {
  items: SpotifyPlaylist[];
  next: string | null;
};

export async function GET() {
  try {
    const session = await getAppSession();
    if (!session.spotify) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    /** Spotify paging can repeat the same playlist across pages; dedupe for stable React keys. */
    const byId = new Map<string, SpotifyPlaylist>();
    let url: string | null = "/me/playlists?limit=50";

    while (url) {
      const page: PlaylistPage = await spotifyApi<PlaylistPage>(url);
      for (const pl of page.items.filter(Boolean)) {
        if (!byId.has(pl.id)) {
          byId.set(pl.id, pl);
        }
      }
      url = page.next;
    }

    return NextResponse.json({ items: [...byId.values()] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
