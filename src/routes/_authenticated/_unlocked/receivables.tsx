import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, HandCoins, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { listReceivables, recordCreditPayment } from "@/lib/transactions.functions";
import { useActiveActivity } from "@/hooks/use-active-activity";
import { usePOS } from "@/hooks/use-pos";

export const Route = createFileRoute("/_authenticated/_unlocked/receivables")({
  component: ReceivablesPage,
});

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " F";
}

function ReceivablesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listReceivables);
  const pay = useServerFn(recordCreditPayment);
  const { activeId } = useActiveActivity();
  const { activePosId } = usePOS();

  const q = useQuery({
    queryKey: ["receivables", activeId ?? "self", activePosId ?? "any"],
    queryFn: () =>
      list({
        data: {
          ...(activeId ? { activityId: activeId } : {}),
          ...(activePosId ? { posId: activePosId } : {}),
        },
      }),
  });

  const [payOpen, setPayOpen] = useState<null | {
    id: string;
    label: string;
    due: number;
  }>(null);
  const [payAmount, setPayAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const submitPayment = async () => {
    if (!payOpen) return;
    const amt = Number(payAmount.replace(/\s/g, "").replace(",", "."));
    if (!amt || amt <= 0) return toast.error("Montant invalide");
    setBusy(true);
    try {
      const res = await pay({ data: { id: payOpen.id, payment: amt } });
      toast.success(res.fully_paid ? "Facture entièrement soldée" : "Paiement enregistré");
      setPayOpen(null);
      setPayAmount("");
      await qc.invalidateQueries({ queryKey: ["receivables"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["all-transactions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const items = q.data?.receivables ?? [];
  const total = q.data?.totalDue ?? 0;

  return (
    <div className="min-h-screen bg-brand-sand pb-24">
      <header className="bg-brand-green text-white px-5 pt-6 pb-8 rounded-b-[2rem]">
        <button
          onClick={() => navigate({ to: "/app" })}
          className="inline-flex items-center gap-2 text-xs text-white/70 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Tableau de bord
        </button>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-gold mb-2">
          Créances clients
        </p>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <HandCoins className="w-7 h-7" />
          {formatXOF(total)}
        </h1>
        <p className="text-white/70 text-sm mt-1">
          {items.length} facture{items.length > 1 ? "s" : ""} en attente
        </p>
      </header>

      <section className="px-5 mt-6">
        {items.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center border border-brand-green/10">
            <p className="text-sm text-brand-green/60">Aucune créance en attente.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((t) => {
              const due = Number(t.amount) - Number(t.paid_amount);
              const paid = Number(t.paid_amount);
              return (
                <div key={t.id} className="bg-card rounded-2xl p-4 border border-brand-terracotta/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-brand-green truncate">
                        {t.third_party || t.label || "Client"}
                      </p>
                      <p className="text-[11px] text-brand-green/50 mt-0.5">
                        {t.label && t.third_party ? `${t.label} • ` : ""}
                        {new Date(t.occurred_at).toLocaleDateString("fr-FR")}
                      </p>
                      {paid > 0 && (
                        <p className="text-[11px] text-success mt-0.5">
                          Déjà payé : {formatXOF(paid)} / {formatXOF(Number(t.amount))}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold text-brand-terracotta">
                        {formatXOF(due)}
                      </p>
                      <p className="text-[10px] text-brand-green/50">dû</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setPayOpen({ id: t.id, label: t.third_party || t.label || "Client", due });
                      setPayAmount(String(due));
                    }}
                    className="mt-3 w-full bg-success hover:bg-success/90 text-white"
                  >
                    <Check className="w-4 h-4 mr-1" /> Encaisser un paiement
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={!!payOpen} onOpenChange={(v) => !v && setPayOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Encaisser — {payOpen?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-brand-green/70">
              Reste dû : <span className="font-bold">{formatXOF(payOpen?.due ?? 0)}</span>
            </p>
            <div>
              <Label htmlFor="pay">Montant payé (FCFA)</Label>
              <Input
                id="pay"
                inputMode="numeric"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="text-xl font-display font-bold h-12 mt-1"
                autoFocus
              />
              <p className="text-[11px] text-brand-green/50 mt-1">
                Le reste demeure en créance.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPayOpen(null)} disabled={busy}>
              Annuler
            </Button>
            <Button onClick={submitPayment} disabled={busy} className="bg-success text-white">
              {busy ? "..." : "Valider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
