import { SpotifyApp } from "@/components/SpotifyApp";
import {
  fetchSpotifyMeWithCounts,
  getAppSession,
  spotifyApi,
} from "@/lib/spotify-server";
import type {
  SpotifyArtist,
  SpotifyMeWithCounts,
  SpotifyTrack,
} from "@/lib/spotify-types";

export default async function Home() {
  const session = await getAppSession();
  const initialSessionPresent = Boolean(session.spotify);

  let initialProfile: SpotifyMeWithCounts | null = null;
  let initialTopPreview: {
    artists: SpotifyArtist[];
    tracks: SpotifyTrack[];
  } | null = null;

  if (initialSessionPresent) {
    try {
      initialProfile = await fetchSpotifyMeWithCounts();
    } catch {
      initialProfile = null;
    }
    if (initialProfile) {
      try {
        const [artistsData, tracksData] = await Promise.all([
          spotifyApi<{ items: SpotifyArtist[] }>(
            "/me/top/artists?time_range=medium_term&limit=5",
          ),
          spotifyApi<{ items: SpotifyTrack[] }>(
            "/me/top/tracks?time_range=medium_term&limit=5",
          ),
        ]);
        initialTopPreview = {
          artists: artistsData.items,
          tracks: tracksData.items,
        };
      } catch {
        initialTopPreview = { artists: [], tracks: [] };
      }
    }
  }

  return (
    <SpotifyApp
      initialSessionPresent={initialSessionPresent}
      initialProfile={initialProfile}
      initialTopPreview={initialTopPreview}
    />
  );
}
