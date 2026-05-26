REVOKE SELECT (ip_address) ON public.queue FROM anon, authenticated;
REVOKE SELECT (ip_address) ON public.queue FROM PUBLIC;