import { supabase } from "@/integrations/supabase/client";

export interface QueueItem {
  id: string;
  spotify_track_uri: string;
  title: string;
  artist: string;
  album_cover_url: string;
  requested_by: string;
  created_at: string;
}

export async function addToQueue(track: {
  spotify_track_uri: string;
  title: string;
  artist: string;
  album_cover_url: string;
  requested_by: string;
}) {
  const { error } = await supabase.from('queue').insert(track);
  if (error) throw error;
}

export async function getQueue(): Promise<QueueItem[]> {
  const { data, error } = await supabase
    .from('queue')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as QueueItem[];
}

export async function hasUserPendingSong(userName: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('queue')
    .select('id')
    .eq('requested_by', userName)
    .limit(1);

  if (error) throw error;
  return (data?.length || 0) > 0;
}

export async function removeFromQueue(id: string, spotifyAccessToken: string) {
  const { data, error } = await supabase.functions.invoke('queue-remove', {
    body: { id, spotify_access_token: spotifyAccessToken },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export function subscribeToQueue(callback: (queue: QueueItem[]) => void) {
  // Initial fetch
  getQueue().then(callback);

  // Realtime subscription
  const channel = supabase
    .channel('queue-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'queue' },
      () => {
        getQueue().then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
