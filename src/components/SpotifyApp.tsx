"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  MAX_TOP_LIMIT,
  MIN_TOP_LIMIT,
  TIME_RANGE_LABELS,
  TIME_RANGES,
  type TimeRange,
} from "@/lib/spotify-config";
import type {
  SpotifyArtist,
  SpotifyMeWithCounts,
  SpotifyPlaylist,
  SpotifyPlayHistoryItem,
  SpotifyTrack,
} from "@/lib/spotify-types";

/** Strict Mode remounts abort the previous profile preview fetch; this avoids stale `finally` clearing loading / skipping state updates for the active request. */
let profilePreviewFetchSeq = 0;

type TabId = "profile" | "top-artists" | "top-tracks" | "recent" | "playlists";

/** Full-row link to Spotify (card chrome + hover/focus). */
const SPOTIFY_ROW_LINK_CLASS =
  "group flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 outline-none transition hover:border-[#1DB954] hover:bg-zinc-900/70 focus-visible:ring-2 focus-visible:ring-[#1DB954] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121212]";

const TABS: { id: TabId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "top-artists", label: "Top artists" },
  { id: "top-tracks", label: "Top tracks" },
  { id: "recent", label: "Recent" },
  { id: "playlists", label: "Playlists" },
];

function TabIcon({ id }: { id: TabId }) {
  const cls = "h-4 w-4 shrink-0";
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (id) {
    case "profile":
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path
            {...stroke}
            d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case "top-artists":
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path
            {...stroke}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
      );
    case "top-tracks":
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path
            {...stroke}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
      );
    case "recent":
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path
            {...stroke}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    case "playlists":
      return (
        <svg className={cls} viewBox="0 0 24 24" aria-hidden>
          <path
            {...stroke}
            d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M4.5 6.75h.008v.008H4.5V6.75zm0 5.25h.008v.008H4.5v-.008zm0 5.25h.008v.008H4.5v-.008z"
          />
        </svg>
      );
  }
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function formatPlayedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

type TimeRangeSelectProps = {
  id: string;
  value: TimeRange;
  onChange: (next: TimeRange) => void;
};

function TimeRangeSelect({ id, value, onChange }: TimeRangeSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = `${id}-listbox`;

  const valueIndex = TIME_RANGES.indexOf(value);
  const safeValueIndex = valueIndex >= 0 ? valueIndex : 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc, true);
    return () => document.removeEventListener("pointerdown", onDoc, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const idr = requestAnimationFrame(() => listRef.current?.focus());
    return () => cancelAnimationFrame(idr);
  }, [open]);

  const commit = (next: TimeRange) => {
    onChange(next);
    setOpen(false);
    queueMicrotask(() => buttonRef.current?.focus());
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(TIME_RANGES.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commit(TIME_RANGES[activeIndex]);
    }
  };

  const onButtonKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen((prev) => {
        if (prev) return prev;
        setActiveIndex(safeValueIndex);
        return true;
      });
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setOpen((prev) => {
            const next = !prev;
            if (next) setActiveIndex(safeValueIndex);
            return next;
          });
        }}
        onKeyDown={onButtonKeyDown}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-2xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-sm text-white outline-none transition focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]"
      >
        <span className="whitespace-nowrap">{TIME_RANGE_LABELS[value]}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={`${id}-opt-${TIME_RANGES[activeIndex]}`}
          onKeyDown={onListKeyDown}
          className="absolute z-50 mt-1 flex min-w-full w-max flex-col gap-0.5 rounded-2xl border border-zinc-700 bg-zinc-950 p-1.5 shadow-lg outline-none"
        >
          {TIME_RANGES.map((r, i) => {
            const selected = value === r;
            const active = i === activeIndex;
            return (
              <li
                key={r}
                id={`${id}-opt-${r}`}
                role="option"
                aria-selected={selected}
                className={`cursor-pointer whitespace-nowrap rounded-xl px-3 py-2 text-sm outline-none ${
                  active
                    ? "bg-[#1DB954] text-black"
                    : "text-white hover:bg-[#1DB954] hover:text-black"
                }`}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(r)}
              >
                {TIME_RANGE_LABELS[r]}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

type SpotifyAppProps = {
  /** From the server: is there a Spotify session cookie? Avoids a client fetch gate that can hang. */
  initialSessionPresent: boolean;
  /** Loaded on the server when logged in so Profile isn’t blank (client Strict Mode can cancel fetches). */
  initialProfile: SpotifyMeWithCounts | null;
  /** Top 5 artists/tracks for the profile preview; loaded on the server when logged in. */
  initialTopPreview: {
    artists: SpotifyArtist[];
    tracks: SpotifyTrack[];
  } | null;
};

export function SpotifyApp({
  initialSessionPresent,
  initialProfile,
  initialTopPreview,
}: SpotifyAppProps) {
  /** OAuth ?error= from callback; avoid useSearchParams() — it suspends and can block this tree. */
  const [oauthErrorCode, setOauthErrorCode] = useState<string | null>(null);

  const oauthErrorMessage = useMemo(() => {
    if (!oauthErrorCode) return null;
    if (oauthErrorCode === "access_denied") {
      return "Spotify login was cancelled.";
    }
    if (oauthErrorCode === "invalid_state") {
      return "Login session did not match (invalid_state). Use one origin only: set NEXT_PUBLIC_APP_URL in .env.local to the exact URL you open (e.g. http://127.0.0.1:3000), add that same origin’s /api/auth/callback in Spotify, clear cookies, and try again.";
    }
    return `Something went wrong (${oauthErrorCode}). Try again.`;
  }, [oauthErrorCode]);

  const [authed, setAuthed] = useState<boolean>(initialSessionPresent);
  const [tab, setTab] = useState<TabId>("profile");
  const [timeRange, setTimeRange] = useState<TimeRange>("medium_term");
  const [topLimit, setTopLimit] = useState(20);

  const [profile, setProfile] = useState<SpotifyMeWithCounts | null>(
    initialProfile,
  );
  const [profileTopArtists, setProfileTopArtists] = useState<SpotifyArtist[]>(
    () => initialTopPreview?.artists ?? [],
  );
  const [profileTopTracks, setProfileTopTracks] = useState<SpotifyTrack[]>(
    () => initialTopPreview?.tracks ?? [],
  );
  const [profilePreviewFetching, setProfilePreviewFetching] = useState(false);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[] | null>(null);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[] | null>(null);
  const [recent, setRecent] = useState<SpotifyPlayHistoryItem[] | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);

  const [loadingTab, setLoadingTab] = useState<TabId | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const err = q.get("error");
    if (!err) return;
    window.history.replaceState({}, "", window.location.pathname);
    queueMicrotask(() => setOauthErrorCode(err));
  }, []);

  useEffect(() => {
    if (!authed || tab !== "profile") return;
    const mySeq = ++profilePreviewFetchSeq;
    const ac = new AbortController();
    const stale = () => mySeq !== profilePreviewFetchSeq;
    setFetchError(null);
    setProfilePreviewFetching(true);
    if (profile === null) {
      setLoadingTab("profile");
    }
    (async () => {
      try {
        const topQ = new URLSearchParams({
          time_range: timeRange,
          limit: "5",
        });
        const [meRes, artistsRes, tracksRes] = await Promise.all([
          fetch("/api/spotify/me", {
            cache: "no-store",
            signal: ac.signal,
          }),
          fetch(`/api/spotify/top-artists?${topQ}`, { signal: ac.signal }),
          fetch(`/api/spotify/top-tracks?${topQ}`, { signal: ac.signal }),
        ]);
        if (stale()) return;
        if (
          meRes.status === 401 ||
          artistsRes.status === 401 ||
          tracksRes.status === 401
        ) {
          if (stale()) return;
          setProfile(null);
          setProfileTopArtists([]);
          setProfileTopTracks([]);
          setAuthed(false);
          return;
        }
        if (!meRes.ok) throw new Error("Could not load profile.");
        if (!artistsRes.ok) throw new Error("Could not load top artists.");
        if (!tracksRes.ok) throw new Error("Could not load top tracks.");
        const user = (await meRes.json()) as SpotifyMeWithCounts;
        const artistsData = (await artistsRes.json()) as {
          items: SpotifyArtist[];
        };
        const tracksData = (await tracksRes.json()) as {
          items: SpotifyTrack[];
        };
        if (stale()) return;
        setProfile(user);
        setProfileTopArtists(artistsData.items);
        setProfileTopTracks(tracksData.items);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (stale()) return;
        setFetchError(e instanceof Error ? e.message : "Request failed.");
      } finally {
        setProfilePreviewFetching((busy) =>
          mySeq !== profilePreviewFetchSeq ? busy : false,
        );
        setLoadingTab((lt) => {
          if (mySeq !== profilePreviewFetchSeq) return lt;
          return lt === "profile" ? null : lt;
        });
      }
    })();
    return () => ac.abort();
    // Intentionally omit `profile`: only refetch when auth/tab/timeRange changes; including
    // profile would re-run after every successful load and duplicate requests.
  }, [authed, tab, timeRange]);

  useEffect(() => {
    if (!authed || tab !== "top-artists") return;
    const ac = new AbortController();
    setFetchError(null);
    setLoadingTab("top-artists");
    (async () => {
      try {
        const q = new URLSearchParams({
          time_range: timeRange,
          limit: String(topLimit),
        });
        const res = await fetch(`/api/spotify/top-artists?${q}`, {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error("Could not load top artists.");
        const data = (await res.json()) as { items: SpotifyArtist[] };
        setTopArtists(data.items);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setFetchError(e instanceof Error ? e.message : "Request failed.");
      } finally {
        setLoadingTab((lt) => (lt === "top-artists" ? null : lt));
      }
    })();
    return () => ac.abort();
  }, [authed, tab, timeRange, topLimit]);

  useEffect(() => {
    if (!authed || tab !== "top-tracks") return;
    const ac = new AbortController();
    setFetchError(null);
    setLoadingTab("top-tracks");
    (async () => {
      try {
        const q = new URLSearchParams({
          time_range: timeRange,
          limit: String(topLimit),
        });
        const res = await fetch(`/api/spotify/top-tracks?${q}`, {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error("Could not load top tracks.");
        const data = (await res.json()) as { items: SpotifyTrack[] };
        setTopTracks(data.items);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setFetchError(e instanceof Error ? e.message : "Request failed.");
      } finally {
        setLoadingTab((lt) => (lt === "top-tracks" ? null : lt));
      }
    })();
    return () => ac.abort();
  }, [authed, tab, timeRange, topLimit]);

  useEffect(() => {
    if (!authed || tab !== "recent") return;
    const ac = new AbortController();
    setFetchError(null);
    setLoadingTab("recent");
    (async () => {
      try {
        const q = new URLSearchParams({ limit: String(topLimit) });
        const res = await fetch(`/api/spotify/recent?${q}`, {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error("Could not load recent plays.");
        const data = (await res.json()) as { items: SpotifyPlayHistoryItem[] };
        setRecent(data.items);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setFetchError(e instanceof Error ? e.message : "Request failed.");
      } finally {
        setLoadingTab((lt) => (lt === "recent" ? null : lt));
      }
    })();
    return () => ac.abort();
  }, [authed, tab, topLimit]);

  useEffect(() => {
    if (!authed || tab !== "playlists") return;
    const ac = new AbortController();
    setFetchError(null);
    setLoadingTab("playlists");
    (async () => {
      try {
        const res = await fetch("/api/spotify/playlists", {
          signal: ac.signal,
        });
        if (!res.ok) throw new Error("Could not load playlists.");
        const data = (await res.json()) as { items: SpotifyPlaylist[] };
        setPlaylists(data.items);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setFetchError(e instanceof Error ? e.message : "Request failed.");
      } finally {
        setLoadingTab((lt) => (lt === "playlists" ? null : lt));
      }
    })();
    return () => ac.abort();
  }, [authed, tab]);

  const selectTab = useCallback((id: TabId) => {
    setFetchError(null);
    setTab(id);
  }, []);

  const showTimeRangeControls =
    tab === "top-artists" || tab === "top-tracks";
  const showListControls =
    showTimeRangeControls || tab === "recent";

  const showTabSpinner =
    loadingTab === tab &&
    !(tab === "profile" && profile !== null);

  const title = useMemo(
    () => (
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1DB954]">
          Spotify Stats
        </h1>
        <p className="text-sm text-zinc-400">
          Sign in with your Spotify account to explore your listening profile.
        </p>
      </div>
    ),
    [],
  );

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-1 flex-col justify-center gap-10 px-6 py-16">
        {title}
        {oauthErrorMessage || fetchError ? (
          <div
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {oauthErrorMessage ?? fetchError}
          </div>
        ) : null}
        <a
          href="/api/auth/login"
          className="inline-flex h-12 items-center justify-center rounded-full bg-[#1DB954] px-8 text-sm font-semibold text-black transition hover:bg-[#1ed760]"
        >
          Continue with Spotify
        </a>
        <p className="text-xs text-zinc-500">
          We only request read-only access to your profile, top items, recent
          plays, and playlists. You can disconnect anytime.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1DB954]">
            Spotify Stats
          </h1>
          <p className="text-sm text-zinc-400">
            Signed in as{" "}
            {profile?.external_urls?.spotify ? (
              <a
                href={profile.external_urls.spotify}
                target="_blank"
                rel="noreferrer"
                className="text-zinc-200 transition hover:text-[#1DB954]"
              >
                {profile.display_name ?? "Spotify user"}
              </a>
            ) : (
              <span className="text-zinc-200">
                {profile?.display_name ?? "Spotify user"}
              </span>
            )}
          </p>
        </div>
        <a
          href="/api/auth/logout"
          className="inline-flex h-10 items-center justify-center rounded-full border border-zinc-600 px-5 text-sm font-medium text-zinc-200 transition hover:border-zinc-400 hover:bg-zinc-800"
        >
          Log out
        </a>
      </header>

      <nav
        className="relative z-30 flex gap-1 overflow-x-auto border-b border-zinc-800 bg-[#121212] pb-px"
        aria-label="Sections"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
            className={`inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "border-[#1DB954] text-[#1DB954]"
                : "border-transparent text-zinc-400 hover:text-[#1DB954]"
            }`}
          >
            <TabIcon id={t.id} />
            {t.label}
          </button>
        ))}
      </nav>

      {showListControls ? (
        <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:flex-row sm:items-end sm:justify-between">
          {showTimeRangeControls ? (
            <div className="flex min-w-[220px] flex-col gap-1 sm:min-w-[240px]">
              <label
                htmlFor="time-range"
                className="text-xs font-medium uppercase tracking-wide text-zinc-500"
              >
                Time period
              </label>
              <TimeRangeSelect
                id="time-range"
                value={timeRange}
                onChange={setTimeRange}
              />
            </div>
          ) : null}
          <div className="flex min-w-[200px] flex-1 flex-col gap-1 sm:max-w-xs">
            <label
              htmlFor="top-limit"
              className="text-xs font-medium uppercase tracking-wide text-zinc-500"
            >
              Number of items ({MIN_TOP_LIMIT}–{MAX_TOP_LIMIT})
            </label>
            <input
              id="top-limit"
              type="range"
              min={MIN_TOP_LIMIT}
              max={MAX_TOP_LIMIT}
              value={topLimit}
              onChange={(e) => setTopLimit(Number(e.target.value))}
              className="accent-[#1DB954]"
            />
            <span className="text-sm text-zinc-300">{topLimit} shown</span>
          </div>
        </div>
      ) : null}

      {fetchError ? (
        <div
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          {fetchError}
        </div>
      ) : null}

      <section className="relative z-0 min-h-[240px]">
        {showTabSpinner ? (
          <div className="pointer-events-none flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#1DB954] border-t-transparent" />
          </div>
        ) : null}

        {tab === "profile" && profile ? (
          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
              <div className="shrink-0">
                {profile.images?.[0]?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.images[0].url}
                    alt=""
                    width={200}
                    height={200}
                    className="aspect-square w-full max-w-[200px] rounded-2xl object-cover shadow-lg sm:w-[200px]"
                  />
                ) : (
                  <div className="flex h-[200px] w-[200px] items-center justify-center rounded-2xl bg-zinc-800 text-zinc-500">
                    No image
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3 text-zinc-200">
                <h2 className="text-xl font-semibold">
                  <a
                    href={profile.external_urls.spotify}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white transition hover:text-[#1DB954]"
                  >
                    {profile.display_name ?? "Spotify user"}
                  </a>
                </h2>
                {profile.email ? (
                  <p className="text-sm text-zinc-400">{profile.email}</p>
                ) : null}
                <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  {profile.followers ? (
                    <>
                      <dt className="text-zinc-500">Followers</dt>
                      <dd>{profile.followers.total.toLocaleString()}</dd>
                    </>
                  ) : null}
                  {profile.following_total != null ? (
                    <>
                      <dt className="text-zinc-500">Following</dt>
                      <dd>{profile.following_total.toLocaleString()}</dd>
                    </>
                  ) : null}
                  {profile.playlists_total != null ? (
                    <>
                      <dt className="text-zinc-500">Playlists</dt>
                      <dd>{profile.playlists_total.toLocaleString()}</dd>
                    </>
                  ) : null}
                  {profile.country ? (
                    <>
                      <dt className="text-zinc-500">Country</dt>
                      <dd>{profile.country}</dd>
                    </>
                  ) : null}
                  {profile.product ? (
                    <>
                      <dt className="text-zinc-500">Plan</dt>
                      <dd className="capitalize">{profile.product}</dd>
                    </>
                  ) : null}
                </dl>
                <a
                  href={profile.external_urls.spotify}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex w-fit items-center text-sm font-medium text-[#1DB954] hover:underline"
                >
                  Open in Spotify →
                </a>
              </div>
            </div>

            {profilePreviewFetching &&
            profileTopTracks.length === 0 &&
            profileTopArtists.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-6 py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1DB954] border-t-transparent" />
                <p className="text-xs text-zinc-500">Loading top tracks and artists…</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8 border-t border-zinc-800 pt-10 md:grid-cols-2 md:gap-x-8 md:gap-y-8 lg:gap-x-10">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-lg font-semibold text-white">
                      Top tracks
                    </h3>
                    <span className="text-xs text-zinc-500">
                      {TIME_RANGE_LABELS[timeRange]}
                    </span>
                  </div>
                  {profileTopTracks.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-500">
                      No top tracks for this time range yet.
                    </p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-2">
                      {profileTopTracks.map((tr, i) => (
                        <li key={tr.id}>
                          <a
                            href={tr.external_urls.spotify}
                            target="_blank"
                            rel="noreferrer"
                            className={`${SPOTIFY_ROW_LINK_CLASS} items-center`}
                          >
                            <span className="flex w-6 shrink-0 justify-center text-sm text-zinc-500">
                              {i + 1}
                            </span>
                            {tr.album?.images?.[0]?.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={tr.album.images[0].url}
                                alt=""
                                width={48}
                                height={48}
                                className="h-12 w-12 shrink-0 rounded-md object-cover"
                              />
                            ) : (
                              <div className="h-12 w-12 shrink-0 rounded-md bg-zinc-800" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-white group-hover:text-[#1DB954]">
                                {tr.name}
                              </p>
                              <p className="truncate text-sm text-zinc-400">
                                {tr.artists.map((x) => x.name).join(", ")}
                              </p>
                            </div>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => selectTab("top-tracks")}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#1DB954] transition hover:underline"
                  >
                    View more
                    <span aria-hidden>→</span>
                  </button>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-lg font-semibold text-white">
                      Top artists
                    </h3>
                    <span className="text-xs text-zinc-500">
                      {TIME_RANGE_LABELS[timeRange]}
                    </span>
                  </div>
                  {profileTopArtists.length === 0 ? (
                    <p className="mt-3 text-sm text-zinc-500">
                      No top artists for this time range yet.
                    </p>
                  ) : (
                    <ul className="mt-3 flex flex-col gap-2">
                      {profileTopArtists.map((a, i) => (
                        <li key={a.id}>
                          <a
                            href={a.external_urls.spotify}
                            target="_blank"
                            rel="noreferrer"
                            className={`${SPOTIFY_ROW_LINK_CLASS} items-center`}
                          >
                            <span className="flex w-6 shrink-0 justify-center text-sm text-zinc-500">
                              {i + 1}
                            </span>
                            {a.images?.[0]?.url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={a.images[0].url}
                                alt=""
                                width={48}
                                height={48}
                                className="h-12 w-12 shrink-0 rounded-md object-cover"
                              />
                            ) : (
                              <div className="h-12 w-12 shrink-0 rounded-md bg-zinc-800" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-white group-hover:text-[#1DB954]">
                                {a.name}
                              </p>
                              {a.genres?.length ? (
                                <p className="truncate text-xs text-zinc-500">
                                  {a.genres.slice(0, 2).join(" · ")}
                                </p>
                              ) : null}
                            </div>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => selectTab("top-artists")}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#1DB954] transition hover:underline"
                  >
                    View more
                    <span aria-hidden>→</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {tab === "profile" && !profile && !showTabSpinner && !fetchError ? (
          <p className="py-12 text-center text-sm text-zinc-500">
            Profile didn&apos;t load. Refresh the page or try logging out and back in.
          </p>
        ) : null}

        {tab === "top-artists" && topArtists !== null && !showTabSpinner ? (
          topArtists.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">
              No top artists for this time range yet.
            </p>
          ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {topArtists.map((a, i) => (
              <li key={a.id}>
                <a
                  href={a.external_urls.spotify}
                  target="_blank"
                  rel="noreferrer"
                  className={`${SPOTIFY_ROW_LINK_CLASS} items-center`}
                >
                  <span className="flex w-6 shrink-0 justify-center text-sm text-zinc-500">
                    {i + 1}
                  </span>
                  {a.images?.[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.images[0].url}
                      alt=""
                      width={56}
                      height={56}
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded-lg bg-zinc-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white group-hover:text-[#1DB954]">
                      {a.name}
                    </p>
                    {a.genres?.length ? (
                      <p className="truncate text-xs text-zinc-500">
                        {a.genres.slice(0, 3).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                </a>
              </li>
            ))}
          </ul>
          )
        ) : null}

        {tab === "top-tracks" && topTracks !== null && !showTabSpinner ? (
          topTracks.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">
              No top tracks for this time range yet.
            </p>
          ) : (
          <ul className="flex flex-col gap-2">
            {topTracks.map((tr, i) => (
              <li key={tr.id}>
                <a
                  href={tr.external_urls.spotify}
                  target="_blank"
                  rel="noreferrer"
                  className={`${SPOTIFY_ROW_LINK_CLASS} items-center`}
                >
                  <span className="flex w-6 shrink-0 justify-center text-sm text-zinc-500">
                    {i + 1}
                  </span>
                  {tr.album?.images?.[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tr.album.images[0].url}
                      alt=""
                      width={56}
                      height={56}
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded-lg bg-zinc-800" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white group-hover:text-[#1DB954]">
                      {tr.name}
                    </p>
                    <p className="truncate text-sm text-zinc-400">
                      {tr.artists.map((x) => x.name).join(", ")}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {tr.album.name} · {formatDuration(tr.duration_ms)} · Pop.{" "}
                      {tr.popularity}
                    </p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
          )
        ) : null}

        {tab === "recent" && recent !== null && !showTabSpinner ? (
          recent.length === 0 ||
          recent.every((row) => !row.track) ? (
            <p className="py-12 text-center text-sm text-zinc-500">
              No recent plays returned. Play something in Spotify and try again.
            </p>
          ) : (
          <ul className="flex flex-col gap-2">
            {recent.map((row) => {
              const tr = row.track;
              if (!tr) return null;
              return (
                <li key={`${row.played_at}-${tr.id}`}>
                  <a
                    href={tr.external_urls.spotify}
                    target="_blank"
                    rel="noreferrer"
                    className={SPOTIFY_ROW_LINK_CLASS}
                  >
                    {tr.album?.images?.[0]?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tr.album.images[0].url}
                        alt=""
                        width={48}
                        height={48}
                        className="h-12 w-12 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded-md bg-zinc-800" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white group-hover:text-[#1DB954]">
                        {tr.name}
                      </p>
                      <p className="truncate text-sm text-zinc-400">
                        {tr.artists.map((x) => x.name).join(", ")}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {formatPlayedAt(row.played_at)}
                      </p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
          )
        ) : null}

        {tab === "playlists" && playlists !== null && !showTabSpinner ? (
          playlists.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">
              No playlists found.
            </p>
          ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {playlists.map((pl) => (
              <li key={pl.id}>
                <a
                  href={pl.external_urls.spotify}
                  target="_blank"
                  rel="noreferrer"
                  className={SPOTIFY_ROW_LINK_CLASS}
                >
                  {pl.images?.[0]?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={pl.images[0].url}
                      alt=""
                      width={64}
                      height={64}
                      className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs text-zinc-500">
                      —
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white group-hover:text-[#1DB954]">
                      {pl.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {pl.tracks?.total != null
                        ? `${pl.tracks.total} tracks · `
                        : ""}
                      {pl.owner?.display_name ?? pl.owner?.id ?? "—"}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {pl.public ? "Public" : "Private"}
                      {pl.collaborative ? " · Collaborative" : ""}
                    </p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
          )
        ) : null}
      </section>
    </div>
  );
}
