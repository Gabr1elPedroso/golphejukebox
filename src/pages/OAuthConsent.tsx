import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Pedido de autorização inválido.");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        sessionStorage.setItem("auth_next", window.location.pathname + window.location.search);
        window.location.href = "/";
        return;
      }
      const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) { window.location.href = immediate; return; }
      setDetails(data);
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (error) { setBusy(false); return setError(error.message); }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); return setError("Nenhum redirecionamento retornado."); }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 gradient-primary">
      <div className="w-full max-w-sm space-y-6 text-center text-primary-foreground">
        {error ? (
          <p>Não foi possível carregar este pedido: {error}</p>
        ) : !details ? (
          <p>Carregando…</p>
        ) : (
          <>
            <h1 className="text-2xl font-display font-bold">
              Conectar {details.client?.name ?? "um app"} à sua conta
            </h1>
            <p className="text-primary-foreground/70 text-sm">
              Isso permite que {details.client?.name ?? "o app"} use o Golphe JukeBox em seu nome.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 bg-transparent text-primary-foreground" disabled={busy} onClick={() => decide(false)}>Negar</Button>
              <Button className="flex-1 bg-secondary text-secondary-foreground" disabled={busy} onClick={() => decide(true)}>Aprovar</Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
