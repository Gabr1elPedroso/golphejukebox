
CREATE TABLE public.queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  spotify_track_uri TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album_cover_url TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view the queue" ON public.queue FOR SELECT USING (true);
CREATE POLICY "Anyone can insert into the queue" ON public.queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete from the queue" ON public.queue FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.queue;
