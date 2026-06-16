import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/_unlocked/settings/simulation")({
  component: SimulationPage,
});

type Mode = "credit" | "epargne";

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " F";
}

function SimulationPage() {
  const [mode, setMode] = useState<Mode>("credit");
  return (
    <div className="space-y-5 pb-6">
      <div className="flex gap-2">
        <button onClick={() => setMode("credit")} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider ${mode === "credit" ? "bg-brand-green text-white" : "bg-card border border-brand-green/10 text-brand-green/70"}`}>Crédit</button>
        <button onClick={() => setMode("epargne")} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider ${mode === "epargne" ? "bg-brand-green text-white" : "bg-card border border-brand-green/10 text-brand-green/70"}`}>Épargne</button>
      </div>
      {mode === "credit" ? <CreditSim /> : <EpargneSim />}
    </div>
  );
}

function CreditSim() {
  const [amount, setAmount] = useState(500000);
  const [rate, setRate] = useState(12);
  const [months, setMonths] = useState(12);

  const r = useMemo(() => {
    const i = rate / 100 / 12;
    const m = months;
    const mensualite = i === 0 ? amount / m : (amount * i) / (1 - Math.pow(1 + i, -m));
    const total = mensualite * m;
    return { mensualite, total, interest: total - amount };
  }, [amount, rate, months]);

  return (
    <div className="space-y-4">
      <NumField label="Montant emprunté (F)" value={amount} onChange={setAmount} />
      <NumField label="Taux annuel (%)" value={rate} onChange={setRate} step={0.5} />
      <NumField label="Durée (mois)" value={months} onChange={setMonths} />
      <Result label="Mensualité" value={formatXOF(r.mensualite)} highlight />
      <Result label="Coût total des intérêts" value={formatXOF(r.interest)} />
      <Result label="Total à rembourser" value={formatXOF(r.total)} />
      <p className="text-[11px] text-brand-green/50 leading-relaxed">
        Calcul indicatif (annuité constante). Les conditions réelles peuvent inclure des frais de dossier, assurance, garantie, etc.
      </p>
    </div>
  );
}

function EpargneSim() {
  const [versement, setVersement] = useState(50000);
  const [rate, setRate] = useState(4);
  const [months, setMonths] = useState(24);
  const [initial, setInitial] = useState(0);

  const r = useMemo(() => {
    const i = rate / 100 / 12;
    let capital = initial;
    for (let k = 0; k < months; k++) {
      capital = capital * (1 + i) + versement;
    }
    const totalVerse = initial + versement * months;
    return { capital, totalVerse, gain: capital - totalVerse };
  }, [versement, rate, months, initial]);

  return (
    <div className="space-y-4">
      <NumField label="Capital initial (F)" value={initial} onChange={setInitial} />
      <NumField label="Versement mensuel (F)" value={versement} onChange={setVersement} />
      <NumField label="Taux annuel (%)" value={rate} onChange={setRate} step={0.5} />
      <NumField label="Durée (mois)" value={months} onChange={setMonths} />
      <Result label="Capital final" value={formatXOF(r.capital)} highlight />
      <Result label="Total versé" value={formatXOF(r.totalVerse)} />
      <Result label="Gain (intérêts)" value={formatXOF(r.gain)} />
    </div>
  );
}

function NumField({ label, value, onChange, step }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-green/60">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 w-full bg-card border border-brand-green/10 rounded-lg px-3 py-2 text-sm"
      />
    </label>
  );
}

function Result({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-xl p-3 ${highlight ? "bg-brand-green text-white" : "bg-card border border-brand-green/10"}`}>
      <span className={`text-xs ${highlight ? "text-white/70" : "text-brand-green/60"}`}>{label}</span>
      <span className={`font-display font-bold ${highlight ? "text-lg" : "text-sm text-brand-green"}`}>{value}</span>
    </div>
  );
}
