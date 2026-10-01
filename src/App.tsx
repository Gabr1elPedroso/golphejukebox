import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import GuestPage from "./pages/GuestPage";
import HostPage from "./pages/HostPage";
import NotFound from "./pages/NotFound";
import OAuthConsent from "./pages/OAuthConsent";
import { supabase } from "@/integrations/supabase/client";

const HOST_EMAIL = "host@grupogolphe.com.br";

const ProtectedHost = () => {
  const [status, setStatus] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    const check = (session: any) => {
      const email = session?.user?.email?.toLowerCase() ?? null;
      setStatus(email === HOST_EMAIL ? "ok" : "denied");
    };
    supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => check(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-primary">
        <div className="w-8 h-8 border-3 border-secondary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return status === "ok" ? <HostPage /> : <Navigate to="/" replace />;
};

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<GuestPage />} />
          <Route path="/host" element={<ProtectedHost />} />
          <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
