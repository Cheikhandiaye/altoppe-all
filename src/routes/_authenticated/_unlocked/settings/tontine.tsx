import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mic } from "lucide-react";
import { listByCategory } from "@/lib/settings.functions";

export const Route = createFileRoute("/_authenticated/_unlocked/settings/tontine")({
  component: TontinePage,
});

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " F";
}

function TontinePage() {
  return <CategoryTracker category="Tontine" title="Tontine" subtitle="Cotisations versées" />;
}

export function CategoryTracker({ category, title, subtitle }: { category: string; title: string; subtitle: string }) {
  const fetchList = useServerFn(listByCategory);
  const { data, isLoading } = useQuery({
    queryKey: ["by-category", category],
    queryFn: () => fetchList({ data: { category } }),
  });

  const items = data?.items ?? [];
  const totalIn = items.filter((i) => i.type === "IN").reduce((s, i) => s + Number(i.amount), 0);
  const totalOut = items.filter((i) => i.type === "OUT").reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-4 pb-6">
      <div className="bg-brand-green text-white rounded-2xl p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-gold mb-2">{subtitle}</p>
        <p className="font-display text-3xl font-bold">{formatXOF(totalOut + totalIn)}</p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-[10px] text-white/60 uppercase">Sorties</p>
            <p className="font-bold">{formatXOF(totalOut)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-[10px] text-white/60 uppercase">Entrées</p>
            <p className="font-bold">{formatXOF(totalIn)}</p>
          </div>
        </div>
      </div>

      <Link
        to="/voice"
        className="flex items-center justify-center gap-2 w-full h-12 bg-brand-terracotta text-white font-bold rounded-xl text-sm uppercase tracking-wider"
      >
        <Mic className="w-4 h-4" /> Enregistrer via vocal
      </Link>
      <p className="text-[11px] text-brand-green/50 text-center -mt-2">
        Dites par exemple : « j'ai versé 5000 pour la tontine »
      </p>

      <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-green/60 mt-4">
        Historique {title}
      </h4>
      {isLoading ? (
        <p className="text-sm text-brand-green/60">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-brand-green/40 text-center py-8 bg-card rounded-2xl border border-brand-green/10">
          Aucune opération « {category} » pour le moment.
        </p>
      ) : (
        <div className="bg-card rounded-2xl border border-brand-green/10 overflow-hidden">
          {items.map((t, i) => (
            <div key={t.id} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? "border-t border-brand-green/5" : ""}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-brand-green truncate">{t.label || t.third_party || category}</p>
                <p className="text-[11px] text-brand-green/50 mt-0.5">
                  {new Date(t.occurred_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })} • {t.source}
                </p>
              </div>
              <p className={`font-display font-bold text-sm ${t.type === "IN" ? "text-success" : "text-brand-terracotta"}`}>
                {t.type === "IN" ? "+" : "−"}{formatXOF(Number(t.amount))}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
