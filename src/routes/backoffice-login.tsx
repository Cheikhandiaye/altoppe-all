import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/roles.functions";
import { isStandalonePWA } from "@/lib/pwa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/backoffice-login")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      try {
        const roles = await getMyRoles();
        if (roles.isAdmin) throw redirect({ to: "/admin" });
        if (roles.isCoach) throw redirect({ to: "/coach" });
      } catch (e) {
        if ((e as { isRedirect?: boolean }).isRedirect) throw e;
      }
    }
  },
  component: BackofficeLogin,
});

function BackofficeLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const ua = navigator.userAgent || "";
      setIsMobile(/Android|iPhone|iPad|iPod/i.test(ua) || window.innerWidth < 768 || isStandalonePWA());
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (isMobile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-sand px-6">
        <div className="max-w-md text-center bg-card rounded-3xl shadow-soft p-8 border border-brand-green/10">
          <h1 className="text-2xl font-bold uppercase text-brand-green mb-3">
            AL-<span className="text-brand-terracotta">TOPPE</span>
          </h1>
          <h2 className="font-display text-xl font-bold text-brand-green mb-3">
            Cet espace est réservé aux ordinateurs
          </h2>
          <p className="text-sm text-brand-green/70 mb-6">
            Téléchargez l'app AL-TOPPE sur votre téléphone pour gérer vos comptes.
          </p>
          <a
            href="https://altope.lovable.app"
            className="inline-block bg-brand-green text-white px-5 py-3 rounded-lg font-semibold"
          >
            Télécharger l'app
          </a>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    try {
      const roles = await getMyRoles();
      setLoading(false);
      if (roles.isAdmin) {
        navigate({ to: "/admin" });
      } else if (roles.isCoach) {
        navigate({ to: "/coach" });
      } else {
        await supabase.auth.signOut();
        toast.error("Ce compte n'est pas autorisé sur le backoffice.");
      }
    } catch (err) {
      setLoading(false);
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-sand px-4">
      <div className="w-full max-w-md bg-card rounded-3xl shadow-soft p-8 border border-brand-green/10">
        <h1 className="text-2xl font-bold uppercase text-brand-green tracking-tight mb-2">
          AL-<span className="text-brand-terracotta">TOPPE</span>
        </h1>
        <h2 className="font-display text-2xl font-bold text-brand-green mb-1">
          Accès Coach & Admin
        </h2>
        <p className="text-sm text-brand-green/60 mb-6">
          Interface réservée aux coachs et administrateurs.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11 bg-brand-green hover:bg-brand-green-soft">
            {loading ? "..." : "Se connecter"}
          </Button>
        </form>
      </div>
    </div>
  );
}
