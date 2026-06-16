import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { changePin } from "@/lib/pin.functions";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_unlocked/settings/security")({
  component: SecurityPage,
});

function PinInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-green/60">{label}</span>
      <input
        inputMode="numeric"
        pattern="\d*"
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="mt-1 w-full bg-card border border-brand-green/10 rounded-xl px-4 py-3 text-center font-display text-2xl tracking-[0.5em] text-brand-green focus:outline-none focus:border-brand-terracotta"
        placeholder="••••"
      />
    </label>
  );
}

function SecurityPage() {
  const change = useServerFn(changePin);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (current.length !== 4 || next.length !== 4) {
      toast.error("Chaque code doit avoir 4 chiffres");
      return;
    }
    if (next !== confirm) {
      toast.error("Les nouveaux codes ne correspondent pas");
      return;
    }
    setBusy(true);
    try {
      await change({ data: { currentPin: current, newPin: next } });
      toast.success("Code PIN mis à jour");
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <div className="bg-card rounded-2xl p-4 border border-brand-green/10 flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <p className="font-semibold text-brand-green text-sm">Code PIN</p>
          <p className="text-xs text-brand-green/50">Verrouille l'accès à votre application</p>
        </div>
      </div>

      <form onSubmit={submit} className="bg-card rounded-2xl p-4 border border-brand-green/10 space-y-4">
        <PinInput label="Code PIN actuel" value={current} onChange={setCurrent} />
        <PinInput label="Nouveau code PIN" value={next} onChange={setNext} />
        <PinInput label="Confirmer le nouveau code" value={confirm} onChange={setConfirm} />
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-brand-green text-white rounded-xl py-3 text-sm font-bold uppercase tracking-wider shadow-soft hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Mise à jour…" : "Mettre à jour le code"}
        </button>
      </form>
    </div>
  );
}
