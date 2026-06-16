import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMyRoles } from "@/lib/roles.functions";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      let dest = "/app";
      try {
        const roles = await getMyRoles();
        if (roles.isAdmin) dest = "/admin";
        else if (roles.isCoach) dest = "/coach";
      } catch {
        /* fallback to /app */
      }
      throw redirect({ to: dest });
    }
  },
  head: () => ({
    meta: [
      { title: "AL-TOPPE — Comptabilité SYSCOHADA en Wolof & Français" },
      {
        name: "description",
        content:
          "Tenez la comptabilité de votre commerce en parlant Wolof ou Français. SYSCOHADA simplifié pour entrepreneurs sénégalais.",
      },
      { property: "og:title", content: "AL-TOPPE" },
      {
        property: "og:description",
        content: "Comptabilité vocale bilingue pour entrepreneurs sénégalais.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="max-w-6xl mx-auto flex justify-between items-center px-6 py-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight uppercase text-brand-green">
            AL-<span className="text-brand-terracotta">TOPPE</span>
          </h1>
          <p className="text-[10px] text-brand-green/60 font-medium uppercase tracking-widest">
            Sénégal • SYSCOHADA
          </p>
        </div>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/login"
            className="text-xs font-bold uppercase tracking-widest text-brand-green/70 hover:text-brand-terracotta px-3 py-2"
          >
            Connexion
          </Link>
          <Link
            to="/signup"
            className="text-xs font-bold uppercase tracking-widest bg-brand-terracotta text-white hover:bg-brand-terracotta/90 px-4 py-2 rounded-full"
          >
            Créer un compte
          </Link>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-20 pb-32">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-terracotta mb-6">
          En construction
        </p>
        <h2 className="font-display text-5xl md:text-6xl font-bold leading-[1.05] text-brand-green mb-8">
          La comptabilité de votre commerce, en Wolof ou en Français.
        </h2>
        <p className="text-lg text-brand-green/70 leading-relaxed mb-12 max-w-2xl">
          Parlez à votre téléphone, et AL-TOPPE tient vos comptes SYSCOHADA
          pour vous. Lisez vos SMS Wave et Orange Money automatiquement. Suivez
          votre gain disponible, votre réserve, et la santé de votre commerce
          en un coup d'œil.
        </p>

        <div className="flex flex-wrap gap-3 mb-16">
          <Link
            to="/signup"
            className="inline-flex items-center justify-center h-12 px-6 rounded-full bg-brand-green text-white font-semibold text-sm hover:bg-brand-green-soft"
          >
            Commencer maintenant
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center h-12 px-6 rounded-full border border-brand-green/20 text-brand-green font-semibold text-sm hover:bg-brand-green/5"
          >
            J'ai déjà un compte
          </Link>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-16">
          {[
            { tag: "Étape 1", title: "Compte & code PIN" },
            { tag: "Étape 2", title: "Saisie vocale Wolof/FR" },
            { tag: "Étape 3", title: "Rapports SYSCOHADA" },
          ].map((s) => (
            <div
              key={s.tag}
              className="bg-card rounded-2xl p-5 border border-brand-green/10 shadow-soft"
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta mb-2">
                {s.tag}
              </p>
              <p className="font-semibold text-brand-green">{s.title}</p>
            </div>
          ))}
        </div>

        <div className="bg-brand-green text-white rounded-3xl p-8 relative overflow-hidden">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-3">
            Pour les programmes (DER / 3FPT / GIZ)
          </p>
          <h3 className="font-display text-2xl font-bold mb-3">
            Backoffice coach &amp; admin inclus
          </h3>
          <p className="text-white/70 leading-relaxed text-sm max-w-xl mb-6">
            Suivez vos entrepreneurs assignés, corrigez les catégorisations,
            exportez les Comptes de Résultat annuels SYSCOHADA en un clic, et
            visualisez les indicateurs macro par région et secteur.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/coach"
              className="inline-flex items-center justify-center h-11 px-5 rounded-full bg-brand-gold text-brand-green font-bold text-xs uppercase tracking-widest hover:bg-brand-gold/90"
            >
              Espace coach
            </Link>
            <Link
              to="/admin"
              className="inline-flex items-center justify-center h-11 px-5 rounded-full border border-white/30 text-white font-bold text-xs uppercase tracking-widest hover:bg-white/10"
            >
              Espace admin
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
