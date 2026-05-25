import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Music, Plus, Check, AlertCircle, ListMusic } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchTracks, SpotifyTrack } from "@/lib/spotify";
import { addToQueue } from "@/lib/queue";
import { toast } from "sonner";
import NameEntry from "@/components/guest/NameEntry";
import QueueList from "@/components/guest/QueueList";

const GuestPage = () => {
  const [userName, setUserName] = useState(() => localStorage.getItem("golphe_username") || "");
  const [isNameSet, setIsNameSet] = useState(() => !!localStorage.getItem("golphe_username"));
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingUri, setAddingUri] = useState<string | null>(null);
  const [addedUri, setAddedUri] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setIsSearching(true);
    try {
      setResults(await searchTracks(q));
    } catch {
      toast.error("Erro ao buscar músicas");
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(searchQuery), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, doSearch]);

  const handleAddToQueue = async (track: SpotifyTrack) => {
    const name = localStorage.getItem("golphe_username") || userName;
    setAddingUri(track.uri);
    try {
      const { count } = await addToQueue({
        spotify_track_uri: track.uri,
        title: track.title,
        artist: track.artist,
        album_cover_url: track.albumCover,
        requested_by: name,
      });
      setAddedUri(track.uri);
      const remaining = Math.max(0, 3 - count);
      if (remaining > 0) {
        toast.success(`Música adicionada! Você ainda pode adicionar mais ${remaining} música${remaining === 1 ? '' : 's'}.`);
      } else {
        toast.success("Música adicionada à fila!");
      }
      setTimeout(() => setAddedUri(null), 3000);
    } catch (err: any) {
      if (err?.message === 'IP_LIMIT_REACHED') {
        toast.error("Erro ao adicionar música: você atingiu o limite máximo de 3 faixas na fila.");
      } else {
        toast.error("Erro ao adicionar música. Tente novamente.");
      }
    } finally {
      setAddingUri(null);
    }
  };

  if (!isNameSet) {
    return <NameEntry onNameSet={(name) => { setUserName(name); setIsNameSet(true); }} />;
  }

  const showSearchResults = searchQuery.length >= 2;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 px-4 py-3 shadow-lg" style={{ backgroundColor: '#004a99' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img
              src="https://ujoeexmkvbkoetaspazn.supabase.co/storage/v1/object/public/asset//mascote.png"
              alt="Golphe Mascote"
              className="w-8 h-8 object-contain"
            />
            <span className="font-display font-bold text-white text-sm">GOLPHE JUKEBOX</span>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem("golphe_username");
              setIsNameSet(false);
              setUserName("");
            }}
            className="text-xs text-primary-foreground/60 hover:text-primary-foreground/90"
          >
            Olá, {userName} ✕
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar música..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 rounded-2xl bg-primary-foreground border-0 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-secondary"
          />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 space-y-2">
        {/* Search Results */}
        {showSearchResults && (
          <>
            {isSearching && (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-3 border-secondary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!isSearching && results.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>Nenhuma música encontrada</p>
              </div>
            )}

            {results.map((track) => (
              <div key={track.uri} className="elevated-card flex items-center gap-3 p-3 animate-slide-up">
                <img src={track.albumCover} alt={track.albumName} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-foreground truncate">{track.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                </div>
                <Button
                  size="icon"
                  disabled={addingUri === track.uri || addedUri === track.uri}
                  onClick={() => handleAddToQueue(track)}
                  className={`flex-shrink-0 rounded-xl h-10 w-10 transition-all ${
                    addedUri === track.uri
                      ? "bg-green-500 hover:bg-green-500"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {addedUri === track.uri ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                </Button>
              </div>
            ))}
          </>
        )}

        {/* Queue Section */}
        {!showSearchResults && (
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <ListMusic className="w-5 h-5 text-secondary" />
              <h2 className="font-display font-bold text-foreground text-lg">Fila da Festa</h2>
            </div>
            <QueueList />
          </section>
        )}

        {/* Hint when not searching */}
        {!showSearchResults && (
          <div className="text-center pt-4 text-muted-foreground/50">
            <p className="text-xs">Use a barra acima para buscar e adicionar músicas</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default GuestPage;
