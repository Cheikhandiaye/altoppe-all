import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { getMyRoles } from "@/lib/roles.functions";
import { isStandalonePWA } from "@/lib/pwa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react"; // Importation des icônes de l'œil

const searchSchema = z.object({ redirect: z.string().optional() });

async function destinationForRoles(): Promise<string> {
  try {
    const roles = await getMyRoles();
    if (roles.isAdmin) return "/admin";
    if (roles.isCoach) return "/coach";
    return "/app";
  } catch {
    return "/app";
  }
}

export const Route = createFileRoute("/login")({
  validateSearch: (s) => searchSchema.parse(s),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const dest = search.redirect ?? (await destinationForRoles());
      throw redirect({ to: dest });
    }
  },
  component: LoginPage,
});

function normalizeIdentifier(raw: string): string {
  const s = raw.trim();
  if (s.includes("@")) return s;
  const digits = s.replace(/\D/g, "");
  if (digits.length >= 6) return `pv-${digits}@altope.local`;
  return s;
}

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // État pour afficher/masquer

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const email = normalizeIdentifier(identifier);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    if (isStandalonePWA()) {
      try {
        const roles = await getMyRoles();
        if (!roles.isEntrepreneur && (roles.isCoach || roles.isAdmin)) {
          await supabase.auth.signOut();
          setLoading(false);
          toast.error(
            "Cette application mobile est réservée aux entrepreneurs. Connectez-vous depuis un ordinateur sur altope.lovable.app",
            { duration: 8000 },
          );
          return;
        }
      } catch {
        /* fallback : laisser passer */
      }
    }
    setLoading(false);
    const dest = search.redirect ?? (await destinationForRoles());
    navigate({ to: dest });
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/login",
    });
    if (result.error) toast.error(result.error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-sand px-4">
      <div className="w-full max-w-md bg-card rounded-3xl shadow-soft p-8 border border-brand-green/10">
        <Link to="/" className="block mb-8">
          <h1 className="text-2xl font-bold uppercase text-brand-green tracking-tight">
            AL-<span className="text-brand-terracotta">TOPPE</span>
          </h1>
        </Link>
        <h2 className="font-display text-3xl font-bold text-brand-green mb-2">Connexion</h2>
        <p className="text-sm text-brand-green/60 mb-6">Reprenez la main sur vos comptes.</p>

        <Button onClick={handleGoogle} variant="outline" className="w-full mb-4 h-11">
          Continuer avec Google
        </Button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-brand-green/10" />
          <span className="text-[10px] uppercase tracking-widest text-brand-green/50">ou</span>
          <div className="flex-1 h-px bg-brand-green/10" />
        </div>

        <form onSubmit={handleEmail} className="space-y-4">
          <div>
            <Label htmlFor="identifier">Email ou téléphone</Label>
            <Input
              id="identifier"
              type="text"
              autoComplete="username"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="exemple@mail.com ou +221 77…"
            />
            <p className="text-[10px] text-brand-green/50 mt-1">Vendeur ? Saisissez votre numéro de téléphone.</p>
          </div>
          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-green/40 hover:text-brand-green focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11 bg-brand-green hover:bg-brand-green-soft">
            {loading ? "..." : "Se connecter"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-center text-brand-green/70">
          Pas encore de compte ?{" "}
          <Link to="/signup" className="text-brand-terracotta font-semibold hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
