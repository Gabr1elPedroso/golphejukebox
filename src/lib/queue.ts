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
}) {
  const session_id = getSessionId();
  const { error } = await supabase.from('queue').insert({ ...track, session_id } as any);
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

export async function hasDevicePendingSong(): Promise<boolean> {
  const sessionId = getSessionId();
  const { data, error } = await supabase
    .from('queue')
    .select('id')
    .eq('session_id' as any, sessionId)
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
