import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  User, BarChart3, Calculator, Users, HandCoins, LogOut, Mic, Languages, ShieldCheck, Contact,
  ChevronRight, Briefcase, Store, UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePOS } from "@/hooks/use-pos";

export const Route = createFileRoute("/_authenticated/_unlocked/settings/")({
  component: SettingsHub,
});

type Item = {
  to?: string;
  icon: typeof User;
  label: string;
  desc: string;
  tone?: "green" | "terracotta" | "gold";
  soon?: boolean;
};

const baseSections = (isSeller: boolean, activePosLabel: string | null): { title: string; items: Item[] }[] => [
  {
    title: "Mon activité",
    items: [
      { to: "/settings/profile", icon: User, label: "Profil", desc: "Informations entreprise", tone: "green" },
      ...(isSeller ? [] : [
        { to: "/settings/activities", icon: Briefcase, label: "Mes activités", desc: "Plusieurs activités en une app", tone: "terracotta" as const },
        { to: "/settings/points-de-vente", icon: Store, label: "Point de vente", desc: activePosLabel ? `Actif : ${activePosLabel}` : "Vos codes PV", tone: "terracotta" as const },
        { to: "/settings/vendeurs", icon: UserPlus, label: "Vendeurs", desc: "Comptes par PV", tone: "terracotta" as const },
      ]),
      { to: "/settings/contacts", icon: Contact, label: "Clients & Fournisseurs", desc: "Carnet d'adresses", tone: "green" },
      { to: "/settings/stats", icon: BarChart3, label: "Statistiques", desc: "Analyses & tendances", tone: "green" },
    ],
  },
  {
    title: "Outils financiers",
    items: [
      { to: "/settings/simulation", icon: Calculator, label: "Simulation", desc: "Crédit & épargne", tone: "gold" },
      { to: "/settings/tontine", icon: Users, label: "Tontine", desc: "Suivi cotisations", tone: "gold" },
      { to: "/settings/prets", icon: HandCoins, label: "Prêts", desc: "Suivi des prêts", tone: "gold" },
    ],
  },
  {
    title: "Historique & saisie",
    items: [
      { to: "/voice-history", icon: Mic, label: "Historique vocal", desc: "Saisies audio", tone: "terracotta" },
    ],
  },
  {
    title: "Préférences",
    items: [
      { to: "/settings/language", icon: Languages, label: "Langue", desc: "Français / Wolof", tone: "green" },
      { to: "/settings/security", icon: ShieldCheck, label: "Sécurité", desc: "Modifier le code PIN", tone: "green" },
    ],
  },
];


const toneClasses: Record<NonNullable<Item["tone"]>, string> = {
  green: "bg-brand-green/10 text-brand-green",
  terracotta: "bg-brand-terracotta/10 text-brand-terracotta",
  gold: "bg-brand-gold/15 text-brand-green",
};

function SettingsHub() {
  const navigate = useNavigate();
  const { isSeller, pos, activePosId } = usePOS();
  const activePos = pos.find((p) => p.id === activePosId);
  const activePosLabel = activePos ? `${activePos.code} · ${activePos.name}` : null;
  const sections = baseSections(isSeller, activePosLabel);

  const handleSignOut = async () => {

    await supabase.auth.signOut();
    sessionStorage.removeItem("jc:pin-unlocked");
    toast.success("Déconnecté");
    navigate({ to: "/login" });
  };

  return (
    <div className="space-y-6 pb-6">
      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-green/60 mb-2 px-1">
            {section.title}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {section.items.map((it) => {
              const tone = toneClasses[it.tone ?? "green"];
              const inner = (
                <div className={`bg-card rounded-2xl p-3 border border-brand-green/10 h-full flex flex-col gap-2 transition ${
                  it.soon ? "opacity-60" : "hover:border-brand-terracotta/40 hover:shadow-soft"
                }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tone}`}>
                    <it.icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-green text-sm leading-tight truncate">{it.label}</p>
                    <p className="text-[11px] text-brand-green/50 leading-tight mt-0.5">{it.desc}</p>
                  </div>
                </div>
              );
              if (it.soon || !it.to) return <div key={it.label}>{inner}</div>;
              return (
                <Link key={it.label} to={it.to} className="block">
                  {inner}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-green/60 mb-2 px-1">
          Compte
        </h3>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 bg-brand-terracotta/10 rounded-2xl p-4 border border-brand-terracotta/30 hover:bg-brand-terracotta/20 transition text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-brand-terracotta text-white flex items-center justify-center shrink-0">
            <LogOut className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-brand-terracotta text-sm">Déconnexion</p>
            <p className="text-xs text-brand-terracotta/70">Fermer ma session</p>
          </div>
          <ChevronRight className="w-4 h-4 text-brand-terracotta/60" />
        </button>
      </div>
    </div>
  );
}
