import { supabase } from "@/integrations/supabase/client";

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

export function getSpotifyAuthUrl(): string {
  const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  const redirectUri = `${window.location.origin}/host`;
  const scopes = 'streaming user-read-email user-read-private';

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}
