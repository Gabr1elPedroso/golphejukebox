import { supabase } from "@/integrations/supabase/client";

// Spotify Client ID is public by design in the Authorization Code flow.
// Keep auth URL generation on the frontend so updated scopes go live with the site publish,
// without depending on an Edge Function deployment.
const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || "063aafed92064c278d27e15ddd8e6c15";

const SPOTIFY_AUTH_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative",
];

export interface SpotifyTrack {
  uri: string;
  title: string;
  artist: string;
  albumCover: string;
  albumName: string;
}

export async function searchTracks(query: string): Promise<SpotifyTrack[]> {
  const { data, error } = await supabase.functions.invoke('spotify-search', {
    body: { query },
  });

  if (error) throw new Error(error.message);
  return data.tracks;
}

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const { data, error } = await supabase.functions.invoke('spotify-token', {
    body: { code, redirect_uri: redirectUri },
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function refreshAccessToken(refreshToken: string) {
  const { data, error } = await supabase.functions.invoke('spotify-refresh', {
    body: { refresh_token: refreshToken },
  });

  if (error) throw new Error(error.message);
  return data;
}

export async function getSpotifyAuthUrl(): Promise<string> {
  const redirectUri = `${window.location.origin}/host`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    scope: SPOTIFY_AUTH_SCOPES.join(" "),
    redirect_uri: redirectUri,
    show_dialog: "true",
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}
