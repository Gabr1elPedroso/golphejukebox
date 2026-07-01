import { useState, useEffect, useRef, useCallback } from "react";
import { Music, Disc3, Users, SkipForward, Play, Radio, Settings as SettingsIcon, LogOut } from "lucide-react";
import { QueueItem, subscribeToQueue, removeFromQueue, getQueue } from "@/lib/queue";
import { exchangeCodeForToken, refreshAccessToken, getSpotifyAuthUrl } from "@/lib/spotify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_AUTOPILOT_PLAYLIST_ID = "37i9dQZF1DWYm2pA50XwQJ";
const AUTOPILOT_LABEL = "Rádio Golphe";

const SPOTIFY_TOKEN_KEYS = [
  "spotify_access_token",
  "spotify_refresh_token",
  "spotify_expires_at",
];

function getStoredSpotifyToken(key: string): string | null {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key);
  } catch (e) {
    console.warn("Failed to read Spotify storage", e);
    return null;
  }
}

function persistSpotifyTokens(tokens: { accessToken?: string | null; refreshToken?: string | null; expiresIn?: number | null }) {
  try {
    if (tokens.accessToken) localStorage.setItem("spotify_access_token", tokens.accessToken);
    if (tokens.refreshToken) localStorage.setItem("spotify_refresh_token", tokens.refreshToken);
    if (tokens.expiresIn) localStorage.setItem("spotify_expires_at", String(Date.now() + tokens.expiresIn * 1000));
  } catch (e) {
    console.warn("Failed to persist Spotify tokens", e);
  }
}

function clearSpotifyStorage() {
  try {
    SPOTIFY_TOKEN_KEYS.forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
    Object.keys(localStorage).forEach((k) => {
      if (k.toLowerCase().includes("spotify")) localStorage.removeItem(k);
    });
    Object.keys(sessionStorage).forEach((k) => {
      if (k.toLowerCase().includes("spotify")) sessionStorage.removeItem(k);
    });
  } catch (e) {
    console.warn("Failed to clear Spotify storage", e);
  }
}

function extractPlaylistId(input: string): string {
  if (!input) return '';
  // Remove query parameters primeiro
  const withoutQuery = input.split('?')[0];
  // Handle Spotify URI form: spotify:playlist:<id>
  if (withoutQuery.includes(':')) {
    const uriParts = withoutQuery.split(':');
    return uriParts[uriParts.length - 1].trim();
  }
  // Pega apenas a última parte da URL (o ID)
  const parts = withoutQuery.split('/');
  return parts[parts.length - 1].trim();
}

interface SpotifyPlaylistTrack {
  uri: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  explicit: boolean;
  is_local?: boolean;
}

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

const HostPage = () => {
  const [accessToken, setAccessToken] = useState<string | null>(() => getStoredSpotifyToken("spotify_access_token"));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => getStoredSpotifyToken("spotify_refresh_token"));
  const [spotifyAuthReady, setSpotifyAuthReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentTrack, setCurrentTrack] = useState<QueueItem | null>(null);
  const [isAutopilot, setIsAutopilot] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsActivation, setNeedsActivation] = useState(false);
  const [loading, setLoading] = useState(true);
  const currentTrackRef = useRef<QueueItem | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const playingUriRef = useRef<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const accessTokenRef = useRef<string | null>(accessToken);
  const refreshTokenRef = useRef<string | null>(refreshToken);
  const refreshingRef = useRef<Promise<string | null> | null>(null);
  const endingTrackRef = useRef(false);
  const lastPositionRef = useRef<number>(0);
  const lastTrackUriRef = useRef<string | null>(null);
  const lastDurationRef = useRef<number>(0);
  const manualActionRef = useRef(false);
  const playerRef = useRef<any>(null);
  const autopilotTracksRef = useRef<SpotifyPlaylistTrack[] | null>(null);
  const isAutopilotRef = useRef(false);
  const nowPlayingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [fallbackPlaylistId, setFallbackPlaylistId] = useState<string>(DEFAULT_AUTOPILOT_PLAYLIST_ID);
  const [playlistInput, setPlaylistInput] = useState<string>("");
  const [savingPlaylist, setSavingPlaylist] = useState(false);
  const fallbackPlaylistIdRef = useRef<string>(DEFAULT_AUTOPILOT_PLAYLIST_ID);

  // Keep refs in sync
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { deviceIdRef.current = deviceId; }, [deviceId]);
  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);
  useEffect(() => { refreshTokenRef.current = refreshToken; }, [refreshToken]);

  // Persist tokens to localStorage so they survive reloads / tab close
  useEffect(() => {
    if (accessToken) persistSpotifyTokens({ accessToken });
  }, [accessToken]);
  useEffect(() => {
    if (refreshToken) persistSpotifyTokens({ refreshToken });
  }, [refreshToken]);

  // Restore Spotify auth from storage before the player starts making API calls
  useEffect(() => {
    let cancelled = false;
    const stored = getStoredSpotifyToken("spotify_access_token");
    const storedRefresh = getStoredSpotifyToken("spotify_refresh_token");
    const expiresAt = Number(getStoredSpotifyToken("spotify_expires_at") || "0");

    if (stored) {
      accessTokenRef.current = stored;
      setAccessToken(stored);
    }
    if (storedRefresh) {
      refreshTokenRef.current = storedRefresh;
      setRefreshToken(storedRefresh);
    }
    console.log("[Spotify] Token restaurado do localStorage:", Boolean(stored), "refresh:", Boolean(storedRefresh));

    if (storedRefresh && expiresAt && expiresAt <= Date.now() + 120000) {
      refreshAccessToken(storedRefresh)
        .then((r) => {
          if (cancelled) return;
          persistSpotifyTokens({ accessToken: r.access_token, refreshToken: r.refresh_token || storedRefresh, expiresIn: r.expires_in });
          accessTokenRef.current = r.access_token;
          refreshTokenRef.current = r.refresh_token || storedRefresh;
          setAccessToken(r.access_token);
          setRefreshToken(r.refresh_token || storedRefresh);
        })
        .catch((err) => {
          console.error("[Spotify] Falha ao renovar token restaurado:", err);
          clearSpotifyStorage();
          accessTokenRef.current = null;
          refreshTokenRef.current = null;
          setAccessToken(null);
          setRefreshToken(null);
        })
        .finally(() => {
          if (!cancelled) setSpotifyAuthReady(true);
        });
      return () => { cancelled = true; };
    }

    setSpotifyAuthReady(true);
    return () => { cancelled = true; };
  }, []);

  const disconnectSpotify = useCallback((opts?: { silent?: boolean; reload?: boolean }) => {
    clearSpotifyStorage();
    setAccessToken(null);
    setRefreshToken(null);
    setDeviceId(null);
    setCurrentTrack(null);
    setIsAutopilot(false);
    setIsPlaying(false);
    setNeedsActivation(false);
    setLoading(true);
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    deviceIdRef.current = null;
    playingUriRef.current = null;
    autopilotTracksRef.current = null;
    if (!opts?.silent) {
      toast.success("Spotify desconectado.");
    }
    if (opts?.reload !== false) {
      window.setTimeout(() => window.location.reload(), opts?.silent ? 0 : 350);
    }
  }, []);

  const refreshTokenSilently = useCallback(async (): Promise<string | null> => {
    if (refreshingRef.current) return refreshingRef.current;
    const rt = refreshTokenRef.current;
    if (!rt) {
      console.warn("[Spotify] No refresh token available; forcing reconnect.");
      toast.error("Sessão Spotify expirada. Reconecte para continuar.");
      disconnectSpotify({ silent: true });
      return null;
    }
    refreshingRef.current = (async () => {
      try {
        const r = await refreshAccessToken(rt);
        const nextRefreshToken = r.refresh_token || rt;
        persistSpotifyTokens({ accessToken: r.access_token, refreshToken: nextRefreshToken, expiresIn: r.expires_in });
        setAccessToken(r.access_token);
        setRefreshToken(nextRefreshToken);
        accessTokenRef.current = r.access_token;
        refreshTokenRef.current = nextRefreshToken;
        console.log("[Spotify] Token refreshed silently");
        return r.access_token as string;
      } catch (err) {
        console.error("[Spotify] Refresh failed:", err);
        toast.error("Não foi possível renovar a sessão Spotify. Reconecte.");
        disconnectSpotify({ silent: true });
        return null;
      } finally {
        refreshingRef.current = null;
      }
    })();
    return refreshingRef.current;
  }, [disconnectSpotify]);

  // Authenticated fetch wrapper that handles 401 via refresh
  const spotifyFetch = useCallback(async (url: string, init: RequestInit = {}): Promise<Response> => {
    const token = accessTokenRef.current || getStoredSpotifyToken("spotify_access_token");
    if (token && !accessTokenRef.current) {
      accessTokenRef.current = token;
      setAccessToken(token);
    }
    if (!token) {
      console.warn("[Spotify] Request blocked: no access token restored yet", url);
      return new Response(JSON.stringify({ error: "missing_spotify_access_token" }), { status: 401 });
    }
    const buildHeaders = (t: string) => ({
      ...(init.headers || {}),
      Authorization: `Bearer ${t}`,
    });
    let res = await fetch(url, { ...init, headers: buildHeaders(token) });
    if (res.status === 401) {
      console.warn("[Spotify] 401 received; attempting silent refresh for", url);
      const newToken = await refreshTokenSilently();
      if (!newToken) return res;
      res = await fetch(url, { ...init, headers: buildHeaders(newToken) });
    }
    return res;
  }, [refreshTokenSilently]);
  useEffect(() => { isAutopilotRef.current = isAutopilot; }, [isAutopilot]);
  useEffect(() => { fallbackPlaylistIdRef.current = fallbackPlaylistId; }, [fallbackPlaylistId]);

  // Load fallback playlist id from settings
  useEffect(() => {
    let mounted = true;
    supabase
      .from('app_settings')
      .select('value')
      .eq('id', 'fallback_playlist_id')
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        const val = data?.value || DEFAULT_AUTOPILOT_PLAYLIST_ID;
        setFallbackPlaylistId(val);
        setPlaylistInput(val);
      });
    return () => { mounted = false; };
  }, []);

  const handleSavePlaylist = async () => {
    const id = extractPlaylistId(playlistInput);
    if (!id) {
      toast.error("Link ou ID inválido. Cole um link de playlist do Spotify.");
      return;
    }
    setSavingPlaylist(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('app_settings')
      .upsert({ id: 'fallback_playlist_id', value: id, updated_by: userData.user?.id, updated_at: new Date().toISOString() });
    setSavingPlaylist(false);
    if (error) {
      toast.error("Não foi possível guardar a playlist. Verifique suas permissões.");
      return;
    }
    setFallbackPlaylistId(id);
    setPlaylistInput(id);
    autopilotTracksRef.current = null; // invalidate cache so next autopilot fetches new playlist
    toast.success("Playlist de backup atualizada! 🎵");
  };

  // Broadcast now-playing state to guests
  useEffect(() => {
    if (!nowPlayingChannelRef.current) {
      nowPlayingChannelRef.current = supabase.channel('now-playing', {
        config: { broadcast: { self: false } },
      });
      nowPlayingChannelRef.current.subscribe();
    }
    const ch = nowPlayingChannelRef.current;
    const payload = currentTrack
      ? {
          isAutopilot,
          title: currentTrack.title,
          artist: currentTrack.artist,
          album_cover_url: currentTrack.album_cover_url,
          requested_by: currentTrack.requested_by,
        }
      : { isAutopilot: false, title: null };
    ch.send({ type: 'broadcast', event: 'update', payload });
    // Rebroadcast every 5s so newly-joined guests catch up
    const interval = setInterval(() => {
      ch.send({ type: 'broadcast', event: 'update', payload });
    }, 5000);
    return () => clearInterval(interval);
  }, [currentTrack, isAutopilot]);

  useEffect(() => {
    return () => {
      if (nowPlayingChannelRef.current) {
        supabase.removeChannel(nowPlayingChannelRef.current);
        nowPlayingChannelRef.current = null;
      }
    };
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      window.history.replaceState({}, "", "/host");
      const redirectUri = `${window.location.origin}/host`;
      exchangeCodeForToken(code, redirectUri).then((data) => {
        const nextRefreshToken = data.refresh_token || refreshTokenRef.current;
        persistSpotifyTokens({ accessToken: data.access_token, refreshToken: nextRefreshToken, expiresIn: data.expires_in });
        accessTokenRef.current = data.access_token;
        refreshTokenRef.current = nextRefreshToken;
        setAccessToken(data.access_token);
        setRefreshToken(nextRefreshToken);
        if (data.expires_in && nextRefreshToken) setTimeout(() => {
          if (nextRefreshToken) {
            refreshAccessToken(nextRefreshToken).then((r) => {
              const refreshedRefreshToken = r.refresh_token || nextRefreshToken;
              persistSpotifyTokens({ accessToken: r.access_token, refreshToken: refreshedRefreshToken, expiresIn: r.expires_in });
              accessTokenRef.current = r.access_token;
              refreshTokenRef.current = refreshedRefreshToken;
              setAccessToken(r.access_token);
              setRefreshToken(refreshedRefreshToken);
            });
          }
        }, Math.max((data.expires_in - 120) * 1000, 1000));
      }).catch(() => {
        console.error("Failed to exchange code");
      });
    }
  }, []);

  // Load Spotify SDK + auto-initialize player
  useEffect(() => {
    if (!spotifyAuthReady) return;
    if (!accessToken) return;

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
      const p = new window.Spotify.Player({
        name: "Golphe JukeBox",
        getOAuthToken: (cb: (t: string) => void) => cb(accessTokenRef.current || accessToken),
        volume: 0.8,
      });

      p.addListener("ready", ({ device_id }: { device_id: string }) => {
        console.log("Spotify Player ready, device_id:", device_id);
        setDeviceId(device_id);
        setLoading(false);
        const token = accessTokenRef.current || accessToken;
        // Force transfer playback to THIS device so audio plays on the current browser
        spotifyFetch(`https://api.spotify.com/v1/me/player`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ device_ids: [device_id], play: false }),
        }).catch((e) => console.error("Failed to transfer playback:", e));
        // Ensure repeat mode is OFF so tracks don't loop when queue is empty
        spotifyFetch(`https://api.spotify.com/v1/me/player/repeat?state=off&device_id=${device_id}`, {
          method: "PUT",
        }).catch((e) => console.error("Failed to disable repeat:", e));
      });

      p.addListener("player_state_changed", (state: any) => {
        if (!state) return;
        setIsPlaying(!state.paused);

        const currentUri = state.track_window?.current_track?.uri ?? null;
        const prevPos = lastPositionRef.current;
        const prevDur = lastDurationRef.current;
        const duration = state.duration ?? state.track_window?.current_track?.duration_ms ?? 0;

        // Natural end detection: was playing our track, now paused at position 0
        // and the SDK reports this same track as current (it loops back to start at end).
        const expectedUri = playingUriRef.current;
        // Detect natural end in several SDK-report shapes:
        //  A) same track looped back to 0 while paused (classic end).
        //  B) same track paused at (near) duration.
        //  C) SDK advanced to a different track we didn't ask for (queue exhausted).
        const nearEnd =
          duration > 0 && prevDur > 0 && prevPos > 0 && prevPos >= prevDur - 1500;
        const loopedBackToStart =
          currentUri === expectedUri &&
          state.paused &&
          state.position === 0 &&
          prevPos > 1000;
        const advancedAway =
          expectedUri && currentUri && currentUri !== expectedUri;
        const trackJustEnded =
          !manualActionRef.current &&
          expectedUri &&
          (loopedBackToStart || (state.paused && nearEnd) || advancedAway);

        lastPositionRef.current = state.position;
        lastTrackUriRef.current = currentUri;
        lastDurationRef.current = duration;

        if (trackJustEnded) {
          console.log("[Player] Natural end detected", {
            loopedBackToStart,
            nearEnd,
            advancedAway,
            prevPos,
            prevDur,
            currentUri,
            expectedUri,
          });
          playingUriRef.current = null;
          handleTrackEndedRef.current?.();
        }
      });

      playerRef.current = p;
      p.connect();
    };

    return () => { script.remove(); };
  }, [accessToken, spotifyAuthReady, spotifyFetch]);

  // Safety-net poll: if the SDK ever misses the end event, poll every 1s
  // and force the end handler when we detect the track has finished.
  useEffect(() => {
    if (!deviceId) return;
    const iv = setInterval(async () => {
      const p = playerRef.current;
      if (!p) return;
      if (endingTrackRef.current) return;
      if (manualActionRef.current) return;
      if (!playingUriRef.current) return;
      try {
        const s = await p.getCurrentState();
        if (!s) return;
        const dur = s.duration ?? 0;
        const pos = s.position ?? 0;
        const uri = s.track_window?.current_track?.uri ?? null;
        // If we still hold a playingUri but the SDK reports paused at start (looped)
        // or paused very close to the end, treat as natural end.
        const finished =
          (s.paused && pos === 0 && lastPositionRef.current > 1000) ||
          (s.paused && dur > 0 && pos >= dur - 1500) ||
          (uri && uri !== playingUriRef.current);
        if (finished) {
          console.log("[Player] Poll detected end, invoking handler", { pos, dur, uri, expected: playingUriRef.current });
          playingUriRef.current = null;
          handleTrackEndedRef.current?.();
        }
      } catch (e) {
        // getCurrentState can throw when player disconnects; ignore
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [deviceId]);

  // Subscribe to queue
  useEffect(() => {
    const unsub = subscribeToQueue((items) => {
      setQueue(items);
    });
    return unsub;
  }, []);

  const playTrack = useCallback(async (uri: string) => {
    const did = deviceIdRef.current;
    const token = accessTokenRef.current;
    if (!did || !token) return;

    manualActionRef.current = true;
    setTimeout(() => { manualActionRef.current = false; }, 1500);

    const res = await spotifyFetch(`https://api.spotify.com/v1/me/player/play?device_id=${did}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: [uri] }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Spotify play error:", res.status, err);
      // Autoplay blocked by browser
      if (res.status === 403) {
        setNeedsActivation(true);
      }
      throw new Error(`Play failed: ${res.status}`);
    }

    setNeedsActivation(false);
    playingUriRef.current = uri;
    lastPositionRef.current = 0;
    lastTrackUriRef.current = uri;
  }, [spotifyFetch]);

  const fetchAutopilotTracks = useCallback(async (): Promise<SpotifyPlaylistTrack[]> => {
    if (autopilotTracksRef.current && autopilotTracksRef.current.length > 0) {
      console.log("[Autopilot] Using cached tracks:", autopilotTracksRef.current.length);
      return autopilotTracksRef.current;
    }
    const token = accessTokenRef.current;
    if (!token) {
      console.warn("[Autopilot] No Spotify access token yet");
      return [];
    }
    const rawId = fallbackPlaylistIdRef.current || DEFAULT_AUTOPILOT_PLAYLIST_ID;
    const playlistId = extractPlaylistId(rawId) || rawId;
    console.log("ID da Playlist extraído:", playlistId, "(raw:", rawId, ")");
    const url = `https://api.spotify.com/v1/playlists/${playlistId}/items?limit=100`;
    console.log("[Autopilot] Fetching:", url);
    const res = await spotifyFetch(url, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("Erro da API do Spotify:", res.status, body);
      if (res.status === 404) {
        toast.error("Playlist não encontrada. Verifique o ID/link salvo.");
      } else if (res.status === 403) {
        toast.error("Sem permissão (403). Reconecte o Spotify para conceder a permissão 'playlist-read'.");
      } else if (res.status === 401) {
        toast.error("Sessão Spotify expirada. Reconecte para continuar.");
      } else {
        toast.error(`Erro ao carregar Piloto Automático (${res.status}).`);
      }
      return [];
    }
    const data = await res.json();
    const allItems = data.items || [];
    // Filtra itens nulos, faixas locais e mantém apenas as NÃO explícitas
    const cleanTracks = allItems
      .map((item: any) => item.track)
      .filter((track: any) => track !== null && !track.is_local)
      .filter((track: any) => track.explicit === false);
    console.log(
      `[Autopilot] Loaded ${allItems.length} items, ${cleanTracks.length} clean (non-explicit)`
    );
    if (cleanTracks.length === 0) {
      toast.error("A playlist do Piloto Automático não tem faixas não-explícitas nesta página.");
      return [];
    }
    autopilotTracksRef.current = cleanTracks;
    return cleanTracks;
  }, [spotifyFetch]);

  const playAutopilotTrack = useCallback(async () => {
    console.log("[Autopilot] Triggering autopilot playback...");
    const tracks = await fetchAutopilotTracks();
    if (tracks.length === 0) {
      console.warn("[Autopilot] No tracks available — staying idle");
      setCurrentTrack(null);
      setIsAutopilot(false);
      setIsPlaying(false);
      return;
    }
    const pick = tracks[Math.floor(Math.random() * tracks.length)];
    console.log("[Autopilot] Picked track:", pick.name, "-", pick.artists.map(a => a.name).join(", "));
    const item: QueueItem = {
      id: `autopilot-${pick.uri}`,
      spotify_track_uri: pick.uri,
      title: pick.name,
      artist: pick.artists.map((a) => a.name).join(', '),
      album_cover_url: pick.album.images?.[0]?.url || '',
      requested_by: AUTOPILOT_LABEL,
      created_at: new Date().toISOString(),
    };
    setIsAutopilot(true);
    setCurrentTrack(item);
    setIsPlaying(true);
    try {
      await playTrack(pick.uri);
    } catch (err) {
      console.error("Error playing autopilot track:", err);
      setIsPlaying(false);
    }
  }, [fetchAutopilotTracks, playTrack]);

  const pausePlayback = useCallback(async () => {
    const did = deviceIdRef.current;
    const token = accessTokenRef.current;
    if (!did || !token) return;
    await spotifyFetch(`https://api.spotify.com/v1/me/player/pause?device_id=${did}`, {
      method: "PUT",
    });
  }, [spotifyFetch]);

  const playNext = useCallback(async () => {
    const q = queueRef.current;
    if (q.length === 0) {
      // Queue empty → enter autopilot
      await playAutopilotTrack();
      return;
    }

    const next = q[0];
    setIsAutopilot(false);
    setCurrentTrack(next);
    setIsPlaying(true);

    try {
      await playTrack(next.spotify_track_uri);
    } catch (err) {
      console.error("Error playing track:", err);
      setIsPlaying(false);
    }
  }, [playTrack, playAutopilotTrack]);

  const handleTrackEnded = useCallback(async () => {
    if (endingTrackRef.current) return;
    endingTrackRef.current = true;
    const track = currentTrackRef.current;
    if (track && !isAutopilotRef.current) {
      console.log("Track ended, removing from queue:", track.title);
      await removeFromQueue(track.id);
    }
    setIsPlaying(false);
    setCurrentTrack(null);
    currentTrackRef.current = null;
    playingUriRef.current = null;
    const freshQueue = await getQueue();
    queueRef.current = freshQueue;

    endingTrackRef.current = false;
    setTimeout(() => playNext(), 250);
  }, [playNext]);

  const handleTrackEndedRef = useRef<() => void>();
  useEffect(() => { handleTrackEndedRef.current = handleTrackEnded; }, [handleTrackEnded]);

  // Auto-play when queue updates and player is idle
  useEffect(() => {
    if (!deviceId) return;
    if (currentTrack) return;
    if (needsActivation) return;
    playNext();
  }, [queue, currentTrack, deviceId, needsActivation, playNext]);

  const handleSkip = async () => {
    const track = currentTrackRef.current;
    if (track && !isAutopilotRef.current) {
      await removeFromQueue(track.id);
    }

    const freshQueue = await getQueue();

    if (freshQueue.length > 0) {
      setIsAutopilot(false);
      const next = freshQueue[0];
      setCurrentTrack(next);
      setIsPlaying(true);
      try {
        await playTrack(next.spotify_track_uri);
      } catch (err) {
        console.error("Error playing next track:", err);
        setIsPlaying(false);
      }
    } else {
      await playAutopilotTrack();
    }
  };

  const handleActivateAudio = async () => {
    setNeedsActivation(false);
    if (queueRef.current.length > 0) {
      await playNext();
    }
  };

  // Login screen
  if (!accessToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gradient-primary">
        <div className="text-center space-y-8 animate-slide-up">
          <div className="space-y-4">
            <img
              src="https://ujoeexmkvbkoetaspazn.supabase.co/storage/v1/object/public/asset//mascote.png"
              alt="Golphe Mascote"
              className="w-32 h-32 object-contain mx-auto"
            />
            <h1 className="text-5xl font-display font-bold text-primary-foreground">
              Golphe JukeBox
            </h1>
            <p className="text-primary-foreground/60 text-lg">Painel do Host</p>
          </div>

          <Button
            onClick={async () => { window.location.href = await getSpotifyAuthUrl(); }}
            className="h-16 px-12 text-lg font-display font-bold rounded-2xl bg-green-500 hover:bg-green-400 text-foreground"
          >
            <Music className="w-6 h-6 mr-3" />
            Conectar com Spotify
          </Button>
        </div>
      </div>
    );
  }

  // Loading SDK / connecting
  if (loading || !deviceId) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-primary">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-secondary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-primary-foreground/70 font-display">Conectando ao player...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-primary flex flex-col relative">
      {/* Header / Brand Banner */}
      <div className="w-full flex items-center gap-3 px-6 py-3 bg-foreground/5 backdrop-blur-sm border-b border-primary-foreground/10">
        <img
          src="https://ujoeexmkvbkoetaspazn.supabase.co/storage/v1/object/public/asset//mascote.png"
          alt="Golphe Mascote"
          className="w-10 h-10 object-contain"
        />
        <h1 className="text-xl font-display font-bold text-primary-foreground">Golphe JukeBox</h1>
        <div className="ml-auto">
          <Button
            onClick={() => disconnectSpotify()}
            variant="outline"
            className="h-9 rounded-lg border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 font-display text-sm"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Desconectar Spotify
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row">
      {/* Autoplay activation overlay */}
      {needsActivation && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Button
            onClick={handleActivateAudio}
            className="h-20 px-16 text-xl font-display font-bold rounded-2xl bg-secondary hover:bg-secondary/90 text-secondary-foreground animate-slide-up"
          >
            <Play className="w-8 h-8 mr-3" />
            Clique para ativar o áudio da festa
          </Button>
        </div>
      )}

      {/* Now Playing */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16">
        {currentTrack ? (
          <div className="text-center space-y-8 animate-slide-up max-w-lg">
            <div className="relative inline-block">
              <img
                src={currentTrack.album_cover_url}
                alt={currentTrack.title}
                className="w-64 h-64 lg:w-80 lg:h-80 rounded-3xl object-cover now-playing-glow"
              />
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-display font-bold">
                {isAutopilot ? "PILOTO AUTOMÁTICO" : "TOCANDO AGORA"}
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl lg:text-4xl font-display font-bold text-primary-foreground">
                {currentTrack.title}
              </h2>
              <p className="text-xl text-primary-foreground/70">{currentTrack.artist}</p>
              {isAutopilot ? (
                <p className="text-sm text-secondary flex items-center justify-center gap-1.5">
                  <Radio className="w-4 h-4" />
                  Tocando {AUTOPILOT_LABEL} · Piloto Automático
                </p>
              ) : (
                <p className="text-sm text-secondary flex items-center justify-center gap-1.5">
                  <Users className="w-4 h-4" />
                  Pedida por {currentTrack.requested_by}
                </p>
              )}
            </div>
            <div className="w-full flex justify-center mt-6">
              <Button
                onClick={handleSkip}
                className="h-12 px-6 rounded-full bg-[#ffc107] hover:bg-[#ffca28] text-[#1a1a2e] font-display font-bold"
              >
                <SkipForward className="w-5 h-5 mr-2" />
                Pular
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-6 animate-slide-up">
            <Disc3 className="w-24 h-24 text-primary-foreground/20 mx-auto" />
            <div>
              <h2 className="text-3xl font-display font-bold text-primary-foreground/40">
                Nenhuma música tocando
              </h2>
              <p className="text-primary-foreground/30 mt-2">
                Aguardando pedidos dos convidados...
              </p>
            </div>
            {queue.length > 0 && (
              <Button
                onClick={playNext}
                className="h-12 px-6 rounded-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-display font-bold"
              >
                <Play className="w-5 h-5 mr-2" />
                Tocar próxima
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Queue sidebar */}
      <div className="w-full lg:w-96 bg-foreground/5 backdrop-blur-sm border-l border-primary-foreground/10 p-6 overflow-y-auto max-h-screen">
        {/* Autopilot config */}
        <div className="mb-6 p-4 rounded-xl bg-primary-foreground/5 border border-primary-foreground/10">
          <h3 className="font-display font-bold text-primary-foreground/80 text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-secondary" />
            Configuração do Piloto Automático
          </h3>
          <p className="text-xs text-primary-foreground/50 mb-2">
            Playlist tocada quando a fila estiver vazia.
          </p>
          <div className="flex flex-col gap-2">
            <Input
              value={playlistInput}
              onChange={(e) => setPlaylistInput(e.target.value)}
              placeholder="Link ou ID da playlist Spotify"
              className="bg-background/10 text-primary-foreground placeholder:text-primary-foreground/30 border-primary-foreground/20"
            />
            <Button
              onClick={handleSavePlaylist}
              disabled={savingPlaylist}
              className="h-9 rounded-lg bg-secondary hover:bg-secondary/90 text-secondary-foreground font-display font-bold text-sm"
            >
              {savingPlaylist ? "A guardar..." : "Guardar Playlist"}
            </Button>
            <p className="text-[10px] text-primary-foreground/40 truncate">
              Atual: {fallbackPlaylistId}
            </p>
          </div>
        </div>

        <h3 className="font-display font-bold text-primary-foreground/80 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
          <Music className="w-4 h-4 text-secondary" />
          Próximas ({queue.length})
        </h3>

        {queue.length === 0 ? (
          <p className="text-primary-foreground/30 text-sm text-center py-8">
            A fila está vazia
          </p>
        ) : (
          <div className="space-y-2">
            {queue.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-primary-foreground/5 hover:bg-primary-foreground/10 transition-colors animate-slide-up"
              >
                <span className="text-xs font-display font-bold text-secondary w-5 text-center">
                  {i + 1}
                </span>
                <img
                  src={item.album_cover_url}
                  alt={item.title}
                  className="w-10 h-10 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary-foreground truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-primary-foreground/50 truncate">
                    {item.artist} · {item.requested_by}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default HostPage;
