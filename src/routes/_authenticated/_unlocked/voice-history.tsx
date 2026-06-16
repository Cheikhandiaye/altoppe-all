import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listVoiceHistory } from "@/lib/voice.functions";
import { validateTransaction, deleteTransaction } from "@/lib/transactions.functions";
import { findCategory } from "@/lib/syscohada";
import { ArrowLeft, AlertTriangle, Check, Trash2, Mic } from "lucide-react";
import { toast } from "sonner";

const historyQuery = queryOptions({
  queryKey: ["voice-history"],
  queryFn: () => listVoiceHistory(),
});

export const Route = createFileRoute("/_authenticated/_unlocked/voice-history")({
  loader: ({ context }) => context.queryClient.ensureQueryData(historyQuery),
  component: VoiceHistoryPage,
});

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " F";
}

function VoiceHistoryPage() {
  const fetch = useServerFn(listVoiceHistory);
  const validate = useServerFn(validateTransaction);
  const del = useServerFn(deleteTransaction);
  const qc = useQueryClient();
  const { data } = useSuspenseQuery({ ...historyQuery, queryFn: () => fetch() });

  const refresh = () => qc.invalidateQueries({ queryKey: ["voice-history"] });

  const onValidate = async (id: string) => {
    try {
      await validate({ data: { id } });
      await refresh();
      toast.success("Validé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Supprimer ce brouillon vocal ?")) return;
    try {
      await del({ data: { id } });
      await refresh();
      toast.success("Supprimé");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <div className="min-h-screen bg-brand-sand pb-24">
      <header className="bg-brand-green text-white px-5 pt-6 pb-6 rounded-b-[2rem]">
        <Link to="/app" className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white mb-4">
          <ArrowLeft className="w-3 h-3" /> Tableau de bord
        </Link>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-gold mb-1">
          Historique vocal
        </p>
        <h1 className="font-display text-2xl font-bold">
          Saisies audio
        </h1>
        <p className="text-xs text-white/60 mt-1">
          {data.transactions.length} transcription(s) · {data.errors.length} erreur(s) IA
        </p>
      </header>

      <main className="px-5 pt-6 space-y-6">
        {data.errors.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-brand-terracotta mb-2 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Erreurs IA récentes
            </h2>
            <div className="bg-card rounded-2xl border border-brand-terracotta/30 divide-y divide-brand-green/5">
              {data.errors.map((e) => (
                <div key={e.id} className="p-3 text-xs">
                  <p className="font-semibold text-brand-terracotta">{e.error_message}</p>
                  {e.transcript && (
                    <p className="italic text-brand-green/70 mt-1">« {e.transcript} »</p>
                  )}
                  <p className="text-[10px] text-brand-green/40 mt-1">
                    {new Date(e.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-xs font-bold uppercase tracking-widest text-brand-green/60 mb-2 flex items-center gap-1">
            <Mic className="w-3 h-3" /> Transcriptions
          </h2>
          {data.transactions.length === 0 ? (
            <div className="bg-card rounded-2xl p-8 text-center text-sm text-brand-green/60">
              Aucune saisie vocale pour le moment.
            </div>
          ) : (
            <ul className="space-y-3">
              {data.transactions.map((t) => {
                const raw = t.raw_extraction as Record<string, unknown> | null;
                return (
                  <li
                    key={t.id}
                    className="bg-card rounded-2xl border border-brand-green/10 p-4"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-brand-green truncate">
                            {t.label || "Sans libellé"}
                          </p>
                          {t.validation_status === "A_VALIDER" ? (
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-brand-terracotta/15 text-brand-terracotta px-1.5 py-0.5 rounded">
                              Brouillon
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-success/20 text-success px-1.5 py-0.5 rounded">
                              Validé
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-brand-green/50">
                          {new Date(t.occurred_at).toLocaleString("fr-FR")} ·{" "}
                          {t.category ? findCategory(t.category)?.label ?? t.category : "Sans catégorie"}
                        </p>
                      </div>
                      <p
                        className={`font-display font-bold text-sm ${
                          t.type === "IN" ? "text-success" : "text-brand-terracotta"
                        }`}
                      >
                        {t.type === "IN" ? "+" : "−"}
                        {formatXOF(Number(t.amount))}
                      </p>
                    </div>

                    {t.transcript && (
                      <p className="mt-2 text-xs italic text-brand-green/70 bg-brand-sand rounded-lg p-2">
                        « {t.transcript} »
                      </p>
                    )}

                    {raw && (
                      <details className="mt-2">
                        <summary className="text-[10px] uppercase tracking-widest text-brand-green/40 cursor-pointer hover:text-brand-green">
                          Données IA extraites
                        </summary>
                        <pre className="mt-1 text-[10px] bg-brand-ink/5 rounded-lg p-2 overflow-x-auto text-brand-green/70">
                          {JSON.stringify(raw, null, 2)}
                        </pre>
                      </details>
                    )}

                    {t.validation_status === "A_VALIDER" && (
                      <div className="flex gap-2 mt-3">
                        <Link
                          to="/transactions"
                          className="flex-1 text-center h-9 inline-flex items-center justify-center rounded-lg bg-brand-sand text-brand-green text-xs font-semibold hover:bg-brand-green/10"
                        >
                          Modifier
                        </Link>
                        <button
                          onClick={() => onValidate(t.id)}
                          className="flex-1 h-9 rounded-lg bg-brand-green text-white text-xs font-semibold inline-flex items-center justify-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Valider
                        </button>
                        <button
                          onClick={() => onDelete(t.id)}
                          className="h-9 px-3 rounded-lg bg-brand-terracotta/10 text-brand-terracotta hover:bg-brand-terracotta/20"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
