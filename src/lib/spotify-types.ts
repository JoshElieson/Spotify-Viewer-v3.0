export interface SpotifyUser {
  id: string;
  display_name: string | null;
  email?: string;
  images: { url: string; height: number | null; width: number | null }[];
  followers?: { total: number };
  country?: string;
  product?: string;
  uri: string;
  external_urls: { spotify: string };
}

/** `/me` plus counts from other endpoints (see `fetchSpotifyMeWithCounts`). */
export type SpotifyMeWithCounts = SpotifyUser & {
  following_total: number | null;
  playlists_total: number | null;
};

export interface SpotifyArtist {
  id: string;
  name: string;
  genres?: string[];
  popularity: number;
  uri: string;
  external_urls: { spotify: string };
  images: { url: string; height: number | null; width: number | null }[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  popularity: number;
  duration_ms: number;
  uri: string;
  external_urls: { spotify: string };
  album: {
    name: string;
    images: { url: string; height: number | null; width: number | null }[];
  };
  artists: { name: string; id: string; external_urls: { spotify: string } }[];
}

export interface SpotifyPlayHistoryItem {
  played_at: string;
  track: SpotifyTrack | null;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  public: boolean;
  collaborative: boolean;
  images: { url: string | null }[];
  tracks?: { total: number };
  owner: { display_name: string | null; id: string };
  external_urls: { spotify: string };
}

export interface Paged<T> {
  items: T[];
  next: string | null;
}
