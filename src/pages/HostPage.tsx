import { useState, useEffect, useRef, useCallback } from "react";
import { Music, Disc3, Users, SkipForward, Play } from "lucide-react";
import { QueueItem, subscribeToQueue, removeFromQueue, getQueue } from "@/lib/queue";
import { exchangeCodeForToken, refreshAccessToken, getSpotifyAuthUrl } from "@/lib/spotify";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}

const HostPage = () => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [_refreshToken, setRefreshToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentTrack, setCurrentTrack] = useState<QueueItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [needsActivation, setNeedsActivation] = useState(false);
  const [loading, setLoading] = useState(true);
  const isPlayingRef = useRef(false);
  const currentTrackRef = useRef<QueueItem | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const playingUriRef = useRef<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const endingTrackRef = useRef(false);
  const trackHasPlayedRef = useRef(false);
  const lastPlayerStateRef = useRef<{ uri: string | null; paused: boolean; position: number; duration: number }>({
    uri: null,
    paused: true,
    position: 0,
    duration: 0,
  });

  // Keep refs in sync
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { deviceIdRef.current = deviceId; }, [deviceId]);
  useEffect(() => { accessTokenRef.current = accessToken; }, [accessToken]);

  // Handle OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      window.history.replaceState({}, "", "/host");
      const redirectUri = `${window.location.origin}/host`;
      exchangeCodeForToken(code, redirectUri).then((data) => {
        setAccessToken(data.access_token);
        setRefreshToken(data.refresh_token);
        setTimeout(() => {
          if (data.refresh_token) {
            refreshAccessToken(data.refresh_token).then((r) => {
              setAccessToken(r.access_token);
            });
          }
        }, (data.expires_in - 120) * 1000);
      }).catch(() => {
        console.error("Failed to exchange code");
      });
    }
  }, []);

  // Load Spotify SDK + auto-initialize player
  useEffect(() => {
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
        fetch(`https://api.spotify.com/v1/me/player`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ device_ids: [device_id], play: false }),
        }).catch((e) => console.error("Failed to transfer playback:", e));
        // Ensure repeat mode is OFF so tracks don't loop when queue is empty
        fetch(`https://api.spotify.com/v1/me/player/repeat?state=off&device_id=${device_id}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
        }).catch((e) => console.error("Failed to disable repeat:", e));
      });

      p.addListener("player_state_changed", (state: any) => {
        if (!state) return;
        const activeUri = playingUriRef.current;
        const spotifyUri = state.track_window?.current_track?.uri || null;
        const position = typeof state.position === "number" ? state.position : 0;
        const duration = typeof state.duration === "number" ? state.duration : 0;
        const previous = lastPlayerStateRef.current;

        if (activeUri && spotifyUri === activeUri && !state.paused && position > 1000) {
          trackHasPlayedRef.current = true;
        }

        const reachedTrackEnd =
          Boolean(activeUri) &&
          spotifyUri === activeUri &&
          state.paused === true &&
          position === 0 &&
          trackHasPlayedRef.current &&
          previous.uri === activeUri &&
          previous.paused === false &&
          previous.duration > 0 &&
          previous.position >= previous.duration - 3000;

        if (reachedTrackEnd && !endingTrackRef.current) {
          void handleTrackEnded();
        }

        lastPlayerStateRef.current = { uri: spotifyUri, paused: state.paused, position, duration };
      });

      p.connect();
    };

    return () => { script.remove(); };
  }, [accessToken]);

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

    const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${did}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: [uri] }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Spotify play error:", res.status, err);
      // Autoplay blocked by browser
      if (res.status === 403 || res.status === 401) {
        setNeedsActivation(true);
      }
      throw new Error(`Play failed: ${res.status}`);
    }

    setNeedsActivation(false);
    playingUriRef.current = uri;
    trackHasPlayedRef.current = false;
    lastPlayerStateRef.current = { uri, paused: true, position: 0, duration: 0 };
  }, []);

  const pausePlayback = useCallback(async () => {
    const did = deviceIdRef.current;
    const token = accessTokenRef.current;
    if (!did || !token) return;
    await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${did}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
  }, []);

  const playNext = useCallback(async () => {
    const q = queueRef.current;
    if (q.length === 0) {
      setCurrentTrack(null);
      setIsPlaying(false);
      playingUriRef.current = null;
      return;
    }

    const next = q[0];
    setCurrentTrack(next);
    setIsPlaying(true);

    try {
      await playTrack(next.spotify_track_uri);
    } catch (err) {
      console.error("Error playing track:", err);
      setIsPlaying(false);
    }
  }, [playTrack, pausePlayback]);

  const handleTrackEnded = useCallback(async () => {
    if (endingTrackRef.current) return;
    endingTrackRef.current = true;
    const track = currentTrackRef.current;
    if (track) {
      console.log("Track ended, removing from queue:", track.title);
      await removeFromQueue(track.id);
    }
    setIsPlaying(false);
    playingUriRef.current = null;
    const freshQueue = await getQueue();
    queueRef.current = freshQueue;

    if (freshQueue.length === 0) {
      setCurrentTrack(null);
      endingTrackRef.current = false;
      return;
    }

    endingTrackRef.current = false;
    setTimeout(() => playNext(), 250);
  }, [playNext, pausePlayback]);

  // Auto-play when queue updates and nothing is playing
  useEffect(() => {
    if (queue.length === 0) return;
    if (!isPlayingRef.current && deviceId && accessToken) {
      playNext();
    }
  }, [queue, deviceId, accessToken, playNext]);

  const handleSkip = async () => {
    const track = currentTrackRef.current;
    if (track) {
      await removeFromQueue(track.id);
    }

    const freshQueue = await getQueue();

    if (freshQueue.length > 0) {
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
      await pausePlayback();
      setCurrentTrack(null);
      setIsPlaying(false);
      playingUriRef.current = null;
      if (endTimerRef.current) {
        clearTimeout(endTimerRef.current);
        endTimerRef.current = null;
      }
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
                TOCANDO AGORA
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl lg:text-4xl font-display font-bold text-primary-foreground">
                {currentTrack.title}
              </h2>
              <p className="text-xl text-primary-foreground/70">{currentTrack.artist}</p>
              <p className="text-sm text-secondary flex items-center justify-center gap-1.5">
                <Users className="w-4 h-4" />
                Pedida por {currentTrack.requested_by}
              </p>
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
          </div>
        )}
      </div>

      {/* Queue sidebar */}
      <div className="w-full lg:w-96 bg-foreground/5 backdrop-blur-sm border-l border-primary-foreground/10 p-6 overflow-y-auto max-h-screen">
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
