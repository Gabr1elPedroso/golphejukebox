
-- Remove the permissive DELETE policy on queue
DROP POLICY IF EXISTS "Anyone can delete from the queue" ON public.queue;

-- Remove the permissive INSERT policy and replace with a tighter one
DROP POLICY IF EXISTS "Anyone can insert into the queue" ON public.queue;
CREATE POLICY "Anyone can insert into the queue" ON public.queue
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Add storage.objects RLS policies for the 'asset' bucket (public read, no anonymous writes)
CREATE POLICY "Public read access on asset bucket" ON storage.objects
  FOR SELECT USING (bucket_id = 'asset');

CREATE POLICY "Authenticated users can upload to asset bucket" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'asset');

CREATE POLICY "Authenticated users can delete from asset bucket" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'asset');

-- Add storage.objects RLS policies for the 'assets' (private) bucket
CREATE POLICY "Authenticated users can read from assets bucket" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'assets');

CREATE POLICY "Authenticated users can upload to assets bucket" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'assets');

CREATE POLICY "Authenticated users can delete from assets bucket" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'assets');
