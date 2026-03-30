
-- Add session_id column for device-level spam prevention
ALTER TABLE public.queue ADD COLUMN session_id text;

-- Allow anyone to delete from queue (needed for host skip functionality)
CREATE POLICY "Anyone can delete from queue"
ON public.queue
FOR DELETE
TO anon, authenticated
USING (true);
