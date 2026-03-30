import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { id, spotify_access_token } = await req.json();

    if (!id || typeof id !== 'string') {
      return new Response(JSON.stringify({ error: 'Valid queue item id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!spotify_access_token || typeof spotify_access_token !== 'string') {
      return new Response(JSON.stringify({ error: 'Spotify access token required (host only)' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the Spotify token is valid by calling Spotify API
    const spotifyRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${spotify_access_token}` },
    });

    if (!spotifyRes.ok) {
      return new Response(JSON.stringify({ error: 'Invalid Spotify token - host authentication failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role to delete from queue
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase.from('queue').delete().eq('id', id);

    if (error) {
      throw new Error(`Failed to remove from queue: ${error.message}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to remove from queue' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
