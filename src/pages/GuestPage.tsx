import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Music, Plus, Check, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchTracks, SpotifyTrack } from "@/lib/spotify";
import { addToQueue, hasUserPendingSong } from "@/lib/queue";
import { toast } from "sonner";

const GuestPage = () => {
  const [userName, setUserName] = useState(() => localStorage.getItem("golphe_username") || "");
  const [isNameSet, setIsNameSet] = useState(() => !!localStorage.getItem("golphe_username"));
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingUri, setAddingUri] = useState<string | null>(null);
  const [addedUri, setAddedUri] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  const handleSetName = () => {
    if (userName.trim().length < 2) {
      toast.error("Nome precisa ter pelo menos 2 caracteres");
      return;
    }
    localStorage.setItem("golphe_username", userName.trim());
    setIsNameSet(true);
  };

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const tracks = await searchTracks(q);
      setResults(tracks);
    } catch {
      toast.error("Erro ao buscar músicas");
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(searchQuery), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, doSearch]);

  const handleAddToQueue = async (track: SpotifyTrack) => {
    const name = localStorage.getItem("golphe_username") || userName;
    setAddingUri(track.uri);

    try {
      const hasPending = await hasUserPendingSong(name);
      if (hasPending) {
        toast.error("Você já tem uma música na fila! Aguarde ela tocar.");
        return;
      }

      await addToQueue({
        spotify_track_uri: track.uri,
        title: track.title,
        artist: track.artist,
        album_cover_url: track.albumCover,
        requested_by: name,
      });

      setAddedUri(track.uri);
      toast.success("Música adicionada à fila!");
      setTimeout(() => setAddedUri(null), 3000);
    } catch {
      toast.error("Erro ao adicionar música à fila");
    } finally {
      setAddingUri(null);
    }
  };

  if (!isNameSet) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gradient-primary">
        <div className="w-full max-w-sm space-y-8 animate-slide-up">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/20 mb-4">
              <Music className="w-5 h-5 text-secondary" />
              <span className="text-secondary font-display font-bold text-sm">GOLPHE JUKEBOX</span>
            </div>
            <h1 className="text-4xl font-display font-bold text-primary-foreground">
              Qual seu nome?
            </h1>
            <p className="text-primary-foreground/70 text-sm">
              Para identificar seus pedidos na fila
            </p>
          </div>

          <div className="space-y-4">
            <Input
              placeholder="Seu nome..."
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSetName()}
              className="h-14 text-lg rounded-2xl bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/40 focus:border-secondary focus:ring-secondary"
            />
            <Button
              onClick={handleSetName}
              className="w-full h-14 text-lg font-display font-bold rounded-2xl bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-all"
            >
              Entrar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 gradient-primary px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-secondary" />
            <span className="font-display font-bold text-primary-foreground text-sm">GOLPHE JUKEBOX</span>
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

      {/* Results */}
      <main className="flex-1 p-4 space-y-2">
        {isSearching && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-3 border-secondary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!isSearching && results.length === 0 && searchQuery.length >= 2 && (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhuma música encontrada</p>
          </div>
        )}

        {!isSearching && results.length === 0 && searchQuery.length < 2 && (
          <div className="text-center py-16 text-muted-foreground">
            <Music className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-display">Pesquise uma música</p>
            <p className="text-sm mt-1">e adicione à fila do DJ</p>
          </div>
        )}

        {results.map((track) => (
          <div
            key={track.uri}
            className="elevated-card flex items-center gap-3 p-3 animate-slide-up"
          >
            <img
              src={track.albumCover}
              alt={track.albumName}
              className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
            />
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
              {addedUri === track.uri ? (
                <Check className="w-5 h-5" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
            </Button>
          </div>
        ))}
      </main>
    </div>
  );
};

export default GuestPage;
