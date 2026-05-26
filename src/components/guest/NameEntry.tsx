import { useState } from "react";
import { Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { useNavigate } from "react-router-dom";

const HOST_EMAIL = "host@grupogolphe.com.br";
const HOST_PASSWORD = "Jukebox@2026";

const NameEntry = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hostLoading, setHostLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Erro ao iniciar login. Tente novamente.");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
    } catch {
      toast.error("Erro ao iniciar login. Tente novamente.");
      setLoading(false);
    }
  };

  const handleHostLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setHostLoading(true);
    if (email.trim().toLowerCase() === HOST_EMAIL && password === HOST_PASSWORD) {
      localStorage.setItem("golphe_host_auth", "true");
      navigate("/host");
    } else {
      toast.error("Credenciais inválidas.");
      setHostLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 gradient-primary">
      <div className="w-full max-w-sm space-y-8 animate-slide-up">
        <div className="text-center space-y-2">
          <img
            src="https://ujoeexmkvbkoetaspazn.supabase.co/storage/v1/object/public/asset//mascote.png"
            alt="Golphe Mascote"
            className="w-32 h-32 mx-auto object-contain mb-2"
          />
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/20 mb-4">
            <Music className="w-5 h-5 text-secondary" />
            <span className="text-secondary font-display font-bold text-sm">GOLPHE JUKEBOX</span>
          </div>
          <h1 className="text-4xl font-display font-bold text-primary-foreground">
            Bem-vindo!
          </h1>
          <p className="text-primary-foreground/70 text-sm">
            Acesso restrito aos membros da Grupo Golphe
          </p>
        </div>

        <form onSubmit={handleHostLogin} className="space-y-3">
          <Input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-xl bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
          />
          <Input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded-xl bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
          />
          <Button
            type="submit"
            disabled={hostLoading || !email || !password}
            variant="outline"
            className="w-full h-11 rounded-xl font-display font-semibold bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
          >
            {hostLoading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="space-y-4">
          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-14 text-lg font-display font-bold rounded-2xl bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-all"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? "Entrando..." : "Entrar com Google"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NameEntry;
