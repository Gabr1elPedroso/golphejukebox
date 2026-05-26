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

export function getSessionId(): string {
  let sessionId = localStorage.getItem("golphe_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("golphe_session_id", sessionId);
  }
  return sessionId;
}

export async function addToQueue(track: {
  spotify_track_uri: string;
  title: string;
  artist: string;
  album_cover_url: string;
  requested_by: string;
}): Promise<{ count: number }> {
  const session_id = getSessionId();
  const { data, error } = await supabase.functions.invoke('queue-add', {
    body: { ...track, session_id },
  });
  if (error) throw error;
  if (data?.error === 'IP_LIMIT_REACHED' || data?.error === 'IP_ALREADY_IN_QUEUE') {
    throw new Error('IP_LIMIT_REACHED');
  }
  if (data?.error) throw new Error(data.error);
  return { count: data?.count ?? 1 };
}

const QUEUE_COLUMNS =
  'id, spotify_track_uri, title, artist, album_cover_url, requested_by, created_at';

export async function getQueue(): Promise<QueueItem[]> {
  const { data, error } = await supabase
    .from('queue')
    .select(QUEUE_COLUMNS)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as QueueItem[];
}

export async function hasDevicePendingSong(): Promise<boolean> {
  const sessionId = getSessionId();
  const { data, error } = await supabase
    .from('queue')
    .select('id')
    .eq('session_id', sessionId)
    .limit(1);

  if (error) throw error;
  return (data?.length || 0) > 0;
}

export async function removeFromQueue(id: string) {
  const { error } = await supabase.from('queue').delete().eq('id', id);
  if (error) throw error;
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
