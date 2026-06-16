import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react"; // Importation des icônes de l'œil

export const Route = createFileRoute("/signup")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // État pour afficher/masquer

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { full_name: fullName, phone },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Compte créé. Bienvenue !");
    navigate({ to: "/app" });
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/app",
    });
    if (result.error) toast.error(result.error.message);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-sand px-4 py-8">
      <div className="w-full max-w-md bg-card rounded-3xl shadow-soft p-8 border border-brand-green/10">
        <Link to="/" className="block mb-8">
          <h1 className="text-2xl font-bold uppercase text-brand-green tracking-tight">
            AL-<span className="text-brand-terracotta">TOPPE</span>
          </h1>
        </Link>
        <h2 className="font-display text-3xl font-bold text-brand-green mb-2">Créer un compte</h2>
        <p className="text-sm text-brand-green/60 mb-6">Démarrez en 30 secondes.</p>

        <Button onClick={handleGoogle} variant="outline" className="w-full mb-4 h-11">
          Continuer avec Google
        </Button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-brand-green/10" />
          <span className="text-[10px] uppercase tracking-widest text-brand-green/50">ou</span>
          <div className="flex-1 h-px bg-brand-green/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="fullName">Nom complet</Label>
            <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+221 ..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Mot de passe (8+ caractères)</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
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
            {loading ? "..." : "Créer mon compte"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-center text-brand-green/70">
          Déjà un compte ?{" "}
          <Link to="/login" className="text-brand-terracotta font-semibold hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
