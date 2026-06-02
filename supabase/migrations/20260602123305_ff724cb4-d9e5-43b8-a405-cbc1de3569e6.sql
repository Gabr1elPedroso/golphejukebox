-- Create app_settings table for global jukebox configuration
CREATE TABLE public.app_settings (
  id TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. guests/anon) can read settings
CREATE POLICY "Settings are readable by everyone"
ON public.app_settings
FOR SELECT
USING (true);

-- Only the host account can insert
CREATE POLICY "Only host can insert settings"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'host@grupogolphe.com.br'
);

-- Only the host account can update
CREATE POLICY "Only host can update settings"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'host@grupogolphe.com.br'
)
WITH CHECK (
  (SELECT email FROM auth.users WHERE id = auth.uid()) = 'host@grupogolphe.com.br'
);

-- Seed default fallback playlist id
INSERT INTO public.app_settings (id, value) VALUES ('fallback_playlist_id', '37i9dQZF1DWYm2pA50XwQJ')
ON CONFLICT (id) DO NOTHING;
