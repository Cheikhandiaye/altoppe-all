import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Mic, Square, Loader2, Lock, ChevronUp, Trash2, RotateCcw, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { parseVoiceTransaction } from "@/lib/voice.functions";
import { updateTransaction, deleteTransaction } from "@/lib/transactions.functions";
import { findCategory, categoriesByType } from "@/lib/syscohada";

export const Route = createFileRoute("/_authenticated/_unlocked/voice")({
  component: VoicePage,
});

type Phase = "idle" | "recording" | "processing" | "done";

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " F";
}

function VoicePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const parse = useServerFn(parseVoiceTransaction);
  const update = useServerFn(updateTransaction);
  const del = useServerFn(deleteTransaction);

  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof parseVoiceTransaction>> | null>(null);
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Set<number>>(new Set());
  const [edits, setEdits] = useState<Record<number, { label: string; category: string }>>({});
  const [isPersonal, setIsPersonal] = useState(false);
  const [isCredit, setIsCredit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [dragY, setDragY] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const LOCK_THRESHOLD = 80;

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  // Pick up audio recorded from the home FAB and auto-process it
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = sessionStorage.getItem("jc:pending-voice");
    if (!raw) return;
    sessionStorage.removeItem("jc:pending-voice");
    let payload: { audio_base64: string; mime: string; audio_hash: string } | null = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (!payload?.audio_base64) return;
    setPhase("processing");
    (async () => {
      try {
        const res = await parse({ data: payload });
        setResult(res);
        setPhase("done");
        await qc.invalidateQueries({ queryKey: ["dashboard"] });
        toast.success(res.duplicate ? "Déjà enregistré — pas de doublon" : "Transaction enregistrée");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur");
        setPhase("idle");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        if (cancelledRef.current) {
          cancelledRef.current = false;
          setPhase("idle");
          return;
        }
        await sendAudio(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setPhase("recording");
      setSeconds(0);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      toast.error("Micro inaccessible. Autorisez l'accès au micro.");
      console.error(err);
    }
  };

  const stopRecording = (cancel = false) => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    cancelledRef.current = cancel;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setPhase(cancel ? "idle" : "processing");
    setLocked(false);
    setDragY(0);
    startYRef.current = null;
  };

  const sendAudio = async (blob: Blob) => {
    try {
      const buf = await blob.arrayBuffer();
      // SHA-256 hash for dedup
      const hashBuf = await crypto.subtle.digest("SHA-256", buf);
      const audio_hash = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      // base64 encode
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const base64 = btoa(binary);
      const res = await parse({
        data: { audio_base64: base64, mime: blob.type || "audio/webm", audio_hash },
      });
      setResult(res);
      setPhase("done");
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(res.duplicate ? "Déjà enregistré — pas de doublon" : "Transaction enregistrée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      setPhase("idle");
    }
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="min-h-screen bg-brand-green text-white flex flex-col">
      <header className="px-5 pt-6">
        <button
          onClick={() => navigate({ to: "/app" })}
          className="inline-flex items-center gap-2 text-xs text-white/70 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> Tableau de bord
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-32 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-gold mb-3">
          Saisie vocale
        </p>
        <h1 className="font-display text-3xl font-bold mb-2">
          Parlez en Wolof ou en Français
        </h1>
        <p className="text-sm text-white/60 mb-12 max-w-xs">
          Ex : « J'ai vendu 3 sacs de riz à 15 000 francs » ou « Jënd naa essence 5 000 ».
        </p>

        {phase === "idle" && (
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
              startYRef.current = e.clientY;
              setDragY(0);
              startRecording();
            }}
            onContextMenu={(e) => e.preventDefault()}
            className="w-32 h-32 rounded-full bg-brand-terracotta hover:bg-brand-terracotta/90 flex items-center justify-center shadow-glow-terracotta transition-transform hover:scale-105 touch-none select-none"
            aria-label="Maintenir pour enregistrer"
          >
            <Mic className="w-12 h-12" />
          </button>
        )}

        {phase === "recording" && (
          <>
            <div className="relative flex flex-col items-center">
              {!locked && (
                <div
                  className="absolute -top-24 flex flex-col items-center text-white/70 pointer-events-none"
                  style={{ opacity: Math.min(1, 0.4 + dragY / LOCK_THRESHOLD) }}
                >
                  <Lock className="w-5 h-5 mb-1" />
                  <ChevronUp className="w-5 h-5 animate-bounce" />
                </div>
              )}
              <button
                onPointerMove={(e) => {
                  if (startYRef.current == null || locked) return;
                  const dy = Math.max(0, startYRef.current - e.clientY);
                  setDragY(dy);
                  if (dy >= LOCK_THRESHOLD) setLocked(true);
                }}
                onPointerUp={() => {
                  if (locked) return;
                  stopRecording(false);
                }}
                onPointerCancel={() => {
                  if (locked) return;
                  stopRecording(true);
                }}
                onClick={() => {
                  if (locked) stopRecording(false);
                }}
                className="w-32 h-32 rounded-full bg-brand-terracotta flex items-center justify-center animate-pulse touch-none select-none"
                style={!locked && dragY > 0 ? { transform: `translateY(-${Math.min(dragY, LOCK_THRESHOLD)}px)` } : undefined}
                aria-label={locked ? "Arrêter" : "Relâcher pour arrêter"}
              >
                {locked ? <Square className="w-12 h-12" fill="currentColor" /> : <Mic className="w-12 h-12" />}
              </button>
            </div>
            <p className="mt-6 font-display text-2xl font-bold tabular-nums text-brand-gold">
              {mm}:{ss}
            </p>
            <p className="text-xs text-white/50 mt-2">
              {locked ? "Appuyez pour arrêter" : "Relâchez pour arrêter · glissez vers le haut pour verrouiller"}
            </p>
          </>
        )}

        {phase === "processing" && (
          <div className="flex flex-col items-center">
            <Loader2 className="w-16 h-16 animate-spin text-brand-gold" />
            <p className="mt-6 text-white/70 text-sm">Transcription et analyse en cours…</p>
          </div>
        )}

        {phase === "done" && result && (() => {
          const visibleIndices = result.parsed
            .map((_, i) => i)
            .filter((i) => !removed.has(i));
          const visibleParsed = visibleIndices.map((i) => result.parsed[i]);
          const allRemoved = visibleIndices.length === 0;
          const resetAll = () => {
            setResult(null);
            setRemoved(new Set());
            setEditing(new Set());
            setEdits({});
            setIsPersonal(false);
            setIsCredit(false);
            setPhase("idle");
          };
          return (
            <div className="w-full max-w-sm bg-white/10 rounded-3xl p-6 text-left backdrop-blur max-h-[calc(100vh-12rem)] overflow-y-auto">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">
                Vous avez dit
              </p>
              <p className="italic text-white/90 mb-5 text-sm leading-relaxed">
                « {result.transcript} »
              </p>

              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">
                {visibleIndices.length} transaction{visibleIndices.length > 1 ? "s" : ""}{" "}
                {visibleIndices.length > 1 ? "retenues" : "retenue"}
              </p>

              {allRemoved ? (
                <div className="bg-white/5 rounded-2xl p-4 text-sm text-white/70 text-center">
                  Toutes les transactions ont été annulées.
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleIndices.map((i) => {
                    const p = result.parsed[i];
                    const t = result.transactions[i];
                    const isEditing = editing.has(i);
                    const draft = edits[i] ?? { label: p.label ?? "", category: p.category ?? "" };
                    const cats = categoriesByType(p.type);
                    return (
                      <div key={i} className="bg-white/5 rounded-2xl p-3 space-y-1.5 text-sm">
                        <Row label="Type" value={p.type === "IN" ? "Recette" : "Dépense"} />
                        <Row label="Montant" value={formatXOF(p.amount)} highlight />
                        {isEditing ? (
                          <div className="space-y-2 pt-2">
                            <div>
                              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-1">Catégorie</label>
                              <select
                                value={draft.category}
                                onChange={(e) =>
                                  setEdits((prev) => ({ ...prev, [i]: { ...draft, category: e.target.value } }))
                                }
                                className="w-full h-10 rounded-lg bg-white/10 border border-white/10 px-2 text-sm text-white"
                              >
                                <option value="" className="text-black">— Non classée —</option>
                                {cats.map((c) => (
                                  <option key={c.code} value={c.code} className="text-black">
                                    {c.code} — {c.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-1">Libellé</label>
                              <input
                                value={draft.label}
                                onChange={(e) =>
                                  setEdits((prev) => ({ ...prev, [i]: { ...draft, label: e.target.value } }))
                                }
                                placeholder="Description"
                                className="w-full h-10 rounded-lg bg-white/10 border border-white/10 px-3 text-sm text-white placeholder:text-white/40"
                              />
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => {
                                  setEditing((prev) => {
                                    const next = new Set(prev);
                                    next.delete(i);
                                    return next;
                                  });
                                  setEdits((prev) => {
                                    const n = { ...prev };
                                    delete n[i];
                                    return n;
                                  });
                                }}
                                className="flex-1 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold inline-flex items-center justify-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" /> Annuler
                              </button>
                              <button
                                onClick={() => {
                                  setEditing((prev) => {
                                    const next = new Set(prev);
                                    next.delete(i);
                                    return next;
                                  });
                                  toast.success("Modifications prêtes — appuyez sur Valider");
                                }}
                                className="flex-1 h-9 rounded-lg bg-brand-gold/30 hover:bg-brand-gold/40 text-xs font-semibold inline-flex items-center justify-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" /> OK
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {(edits[i]?.category ?? p.category) && (
                              <Row
                                label="Catégorie"
                                value={
                                  findCategory(edits[i]?.category ?? p.category ?? "")?.label ??
                                  (edits[i]?.category ?? p.category ?? "")
                                }
                              />
                            )}
                            {(edits[i]?.label ?? p.label) && (
                              <Row label="Description" value={edits[i]?.label ?? p.label ?? ""} />
                            )}
                            {p.third_party && <Row label="Tiers" value={p.third_party} />}
                            <div className="flex gap-2 mt-2">
                              <button
                                disabled={saving}
                                onClick={() => {
                                  setEdits((prev) => ({
                                    ...prev,
                                    [i]: prev[i] ?? { label: p.label ?? "", category: p.category ?? "" },
                                  }));
                                  setEditing((prev) => new Set(prev).add(i));
                                }}
                                className="flex-1 inline-flex items-center justify-center gap-2 h-9 rounded-xl bg-white/5 hover:bg-brand-gold/20 text-xs font-semibold text-white/80 hover:text-brand-gold transition disabled:opacity-50"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Modifier
                              </button>
                              <button
                                disabled={saving}
                                onClick={async () => {
                                  try {
                                    if (t?.id) await del({ data: { id: t.id } });
                                    setRemoved((prev) => {
                                      const next = new Set(prev);
                                      next.add(i);
                                      return next;
                                    });
                                    await qc.invalidateQueries({ queryKey: ["dashboard"] });
                                    toast.success("Transaction annulée");
                                  } catch (err) {
                                    toast.error(err instanceof Error ? err.message : "Erreur");
                                  }
                                }}
                                className="flex-1 inline-flex items-center justify-center gap-2 h-9 rounded-xl bg-white/5 hover:bg-red-500/20 text-xs font-semibold text-white/80 hover:text-red-200 transition disabled:opacity-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Annuler
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!allRemoved && (
                <>
                  <label className="flex items-center gap-3 bg-white/5 hover:bg-white/10 rounded-xl px-4 py-3 mt-5 mb-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPersonal}
                      onChange={(e) => setIsPersonal(e.target.checked)}
                      className="w-4 h-4 accent-brand-gold"
                    />
                    <span className="text-sm">
                      <span className="font-semibold">
                        {visibleParsed.some((p) => p.type === "IN") ? "Recette / dépense personnelle" : "Dépense personnelle"}
                      </span>
                      <span className="block text-[11px] text-white/60">Hors comptabilité du commerce</span>
                    </span>
                  </label>

                  {visibleParsed.some((p) => p.type === "IN") && (
                    <label className="flex items-center gap-3 bg-white/5 hover:bg-white/10 rounded-xl px-4 py-3 mb-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isCredit}
                        onChange={(e) => setIsCredit(e.target.checked)}
                        className="w-4 h-4 accent-brand-gold"
                      />
                      <span className="text-sm">
                        <span className="font-semibold">Vente différée (à crédit)</span>
                        <span className="block text-[11px] text-white/60">Le client n'a pas encore payé. Ajouté aux créances.</span>
                      </span>
                    </label>
                  )}
                </>
              )}

              <div className="flex gap-2 mt-4">
                <button
                  disabled={saving}
                  onClick={resetAll}
                  className="flex-1 h-12 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Reprendre le vocal
                </button>
                {!allRemoved && (
                  <button
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await Promise.all(
                          visibleIndices.map((i) => {
                            const t = result.transactions[i];
                            const parsed = result.parsed[i];
                            const edit = edits[i];
                            const patch: {
                              id: string;
                              is_personal?: boolean;
                              is_credit?: boolean;
                              label?: string | null;
                              category?: string | null;
                            } = { id: t.id };
                            if (isPersonal) patch.is_personal = true;
                            if (isCredit && parsed?.type === "IN") patch.is_credit = true;
                            if (edit) {
                              const newLabel = edit.label.trim();
                              if (newLabel !== (parsed.label ?? "")) patch.label = newLabel || null;
                              if (edit.category !== (parsed.category ?? "")) patch.category = edit.category || null;
                            }
                            if (Object.keys(patch).length === 1) return Promise.resolve();
                            return update({ data: patch });
                          }),
                        );
                        await qc.invalidateQueries({ queryKey: ["dashboard"] });
                        await qc.invalidateQueries({ queryKey: ["receivables"] });
                        navigate({ to: "/app" });
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Erreur");
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="flex-1 h-12 rounded-xl bg-brand-terracotta hover:bg-brand-terracotta/90 text-sm font-semibold disabled:opacity-50"
                  >
                    {saving ? "…" : "Valider"}
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-[11px] uppercase tracking-widest text-white/50">{label}</span>
      <span className={highlight ? "font-display font-bold text-xl text-brand-gold" : "text-white"}>
        {value}
      </span>
    </div>
  );
}
