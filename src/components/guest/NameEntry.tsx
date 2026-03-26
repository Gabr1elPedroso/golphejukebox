import { useState } from "react";
import { Music } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface NameEntryProps {
  onNameSet: (name: string) => void;
}

const NameEntry = ({ onNameSet }: NameEntryProps) => {
  const [userName, setUserName] = useState("");

  const handleSetName = () => {
    if (userName.trim().length < 2) {
      toast.error("Nome precisa ter pelo menos 2 caracteres");
      return;
    }
    localStorage.setItem("golphe_username", userName.trim());
    onNameSet(userName.trim());
  };

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
};

export default NameEntry;
