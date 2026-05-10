import { NextResponse } from "next/server";
import { fetchSpotifyMeWithCounts, getAppSession } from "@/lib/spotify-server";

export async function GET() {
  try {
    const session = await getAppSession();
    if (!session.spotify) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const me = await fetchSpotifyMeWithCounts();
    return NextResponse.json(me);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
