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

export async function getSpotifyAuthUrl(): Promise<string> {
  const redirectUri = `${window.location.origin}/host`;
  const { data, error } = await supabase.functions.invoke('spotify-auth-url', {
    body: { redirect_uri: redirectUri },
  });

  if (error) throw new Error(error.message);
  return data.url;
}
