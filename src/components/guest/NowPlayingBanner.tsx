import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface NowPlaying {
  isAutopilot: boolean;
  title: string | null;
  artist?: string;
  album_cover_url?: string;
}

const NowPlayingBanner = () => {
  const [now, setNow] = useState<NowPlaying | null>(null);

  useEffect(() => {
    const ch = supabase.channel('now-playing', {
      config: { broadcast: { self: false } },
    });
    ch.on('broadcast', { event: 'update' }, ({ payload }) => {
      setNow(payload as NowPlaying);
    }).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  if (!now?.isAutopilot || !now.title) return null;

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/10 border border-secondary/30 animate-slide-up">
      {now.album_cover_url && (
        <img
          src={now.album_cover_url}
          alt={now.title}
          className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] font-display font-bold uppercase tracking-wider text-secondary">
          <Radio className="w-3 h-3" />
          Tocando Rádio Golphe · Piloto Automático
        </div>
        <p className="text-sm font-semibold text-foreground truncate">
          {now.title}
          {now.artist ? <span className="text-muted-foreground font-normal"> · {now.artist}</span> : null}
        </p>
      </div>
    </div>
  );
};

export default NowPlayingBanner;