import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useCallback, useEffect, useRef } from "react";
import { getDashboard } from "@/lib/dashboard.functions";
import { listReceivables } from "@/lib/transactions.functions";
import { toggleBilanCompletVocal, stopBilanVocal } from "@/utils/wolofTTS";
import { getAudioPrefs } from "@/lib/audio-prefs";

import {
  Mic,
  Plus,
  Volume2,
  VolumeX,
  Loader2,
  HandCoins,
  Eye,
  EyeOff,
  Square,
  Lock,
  ChevronUp,
  Briefcase,
  Receipt,
  FileText,
  Droplet,
  Bus,
  ShoppingBag,
  Utensils,
  Wrench,
  Tag,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

import { useNavigate } from "@tanstack/react-router";
import { useActiveActivity } from "@/hooks/use-active-activity";
import { usePOS } from "@/hooks/use-pos";
import { TransactionReceiptSheet, type ReceiptTxn } from "@/components/TransactionReceiptSheet";
import { InvoiceModal, type InvoiceLine } from "@/components/InvoiceModal";
import { getMyProfile } from "@/lib/settings.functions";

type Period = "day" | "month" | "year";

const dashboardQuery = (period: Period, activityId: string | "ALL" | null, posId: string | "ALL" | null) =>
  queryOptions({
    queryKey: ["dashboard", period, activityId ?? "self", posId ?? "any"],
    queryFn: () =>
      getDashboard({
        data: {
          period,
          ...(activityId ? { activityId } : {}),
          ...(posId ? { posId } : {}),
        },
      }),
  });

export const Route = createFileRoute("/_authenticated/_unlocked/app")({
  component: Dashboard,
});

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " F";
}

// ===== Category visual mapping (pastel) =====
type CatVisual = { Icon: typeof Tag; bg: string; fg: string };
function categoryVisual(category: string | null | undefined, type: "IN" | "OUT"): CatVisual {
  const c = (category ?? "").toLowerCase();
  if (/eau|boisson|bouteille/.test(c)) return { Icon: Droplet, bg: "bg-[#D6E9F2]", fg: "text-[#2E6B8A]" };
  if (/transport|taxi|bus|carburant/.test(c)) return { Icon: Bus, bg: "bg-[#F7DCD4]", fg: "text-[#C97B5F]" };
  if (/aliment|nourri|repas|sachet|lait/.test(c)) return { Icon: Utensils, bg: "bg-[#FCE3C5]", fg: "text-[#B8742A]" };
  if (/vente|client|recette/.test(c)) return { Icon: ShoppingBag, bg: "bg-[#F2D7E0]", fg: "text-[#B8497A]" };
  if (/service|main|prest|répar/.test(c)) return { Icon: Wrench, bg: "bg-[#E2DCF2]", fg: "text-[#6B5BA5]" };
  // fallback by type
  return type === "IN"
    ? { Icon: ShoppingBag, bg: "bg-[#DCEAD9]", fg: "text-[#3C7A52]" }
    : { Icon: Tag, bg: "bg-[#F1E3D5]", fg: "text-[#8B6F5E]" };
}

function formatDateGroup(d: Date, today: Date) {
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const dateStr = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  if (sameDay(d, today)) return `Aujourd'hui, ${dateStr}`;
  if (sameDay(d, yesterday)) return `Hier, ${dateStr}`;
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function Dashboard() {
  const fetchDashboard = useServerFn(getDashboard);
  const fetchReceivables = useServerFn(listReceivables);
  const fetchProfile = useServerFn(getMyProfile);
  const [period, setPeriod] = useState<Period>("year");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [receiptTxn, setReceiptTxn] = useState<ReceiptTxn | null>(null);
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLine[] | null>(null);

  // État local pour ouvrir/fermer le sélecteur d'activités
  const [isActivityOpen, setIsActivityOpen] = useState(false);

  // Destructuration de useActiveActivity
  const { activeId, setActive, activities, isLoading: actLoading } = useActiveActivity();
  const { activePosId, isLoading: posLoading } = usePOS();

  const opts = dashboardQuery(period, activeId, activePosId);
  const { data, isLoading } = useQuery({
    ...opts,
    queryFn: () =>
      fetchDashboard({
        data: {
          period,
          ...(activeId ? { activityId: activeId } : {}),
          ...(activePosId ? { posId: activePosId } : {}),
        },
      }),
  });
  const receivablesQ = useQuery({
    queryKey: ["receivables", activeId ?? "self", activePosId ?? "any"],
    queryFn: () =>
      fetchReceivables({
        data: {
          ...(activeId ? { activityId: activeId } : {}),
          ...(activePosId ? { posId: activePosId } : {}),
        },
      }),
  });
  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });
  const companyName = profileQ.data?.profile?.business_name ?? profileQ.data?.profile?.full_name ?? null;
  const companyPhone = (profileQ.data?.profile as { phone?: string | null } | undefined)?.phone ?? null;
  const companyNinea = (profileQ.data?.profile as { ninea?: string | null } | undefined)?.ninea ?? null;

  const navigate = useNavigate();

  // ===== Hold-to-record voice FAB =====
  type RecPhase = "idle" | "recording" | "sending";
  const [recPhase, setRecPhase] = useState<RecPhase>("idle");
  const [recSeconds, setRecSeconds] = useState(0);
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
      stopBilanVocal();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
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
          setRecPhase("idle");
          return;
        }
        await handoffAudio(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecPhase("recording");
      setRecSeconds(0);
      timerRef.current = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
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
    setRecPhase(cancel ? "idle" : "sending");
    setLocked(false);
    setDragY(0);
    startYRef.current = null;
  };

  const handoffAudio = async (blob: Blob) => {
    try {
      const buf = await blob.arrayBuffer();
      const hashBuf = await crypto.subtle.digest("SHA-256", buf);
      const audio_hash = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const base64 = btoa(binary);
      sessionStorage.setItem(
        "jc:pending-voice",
        JSON.stringify({ audio_base64: base64, mime: blob.type || "audio/webm", audio_hash }),
      );
      navigate({ to: "/voice" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
      setRecPhase("idle");
    }
  };

  const recMM = String(Math.floor(recSeconds / 60)).padStart(2, "0");
  const recSS = String(recSeconds % 60).padStart(2, "0");

  const totalsMaybe = data?.totals;
  const isNegative = (totalsMaybe?.gain ?? 0) < 0;

  const speakSummary = useCallback(() => {
    if (!totalsMaybe) return;
    const langueLecture = getAudioPrefs().amountLang;
    const started = toggleBilanCompletVocal(
      Math.round(totalsMaybe.income),
      Math.round(totalsMaybe.expense),
      Math.round(isNegative ? totalsMaybe.gain : totalsMaybe.available),
      langueLecture,
      () => setIsSpeaking(false),
    );
    setIsSpeaking(started);
  }, [totalsMaybe, isNegative]);

  if (!data || isLoading || actLoading || posLoading) {
    return (
      <div className="min-h-screen bg-brand-sand flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-brand-green/40" />
      </div>
    );
  }

  const { transactions, pending, totals } = data;

  const periods: { key: Period; label: string }[] = [
    { key: "day", label: "Aujourd'hui" },
    { key: "month", label: "Ce mois" },
    { key: "year", label: "Cette année" },
  ];

  const shown = transactions.slice(0, 10);
  const today = new Date();
  const groups = new Map<string, typeof shown>();
  for (const t of shown) {
    const d = new Date(t.occurred_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  const openInvoiceFor = (t: (typeof transactions)[number]) => {
    setInvoiceLines([
      {
        id: t.id,
        label: t.label ?? null,
        category: t.category ?? null,
        amount: t.amount,
        occurred_at: t.occurred_at,
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-brand-sand pb-28">
      {/* ===== HEADER ===== */}
      <header className="bg-[#1B3A2B] text-white px-5 pt-3 pb-4 rounded-b-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
        {/* Top row: Sélecteur d'activité contextuel | AL-TOPPE | speaker */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 mb-3">
          {/* CONTAINER DROPDOWN DE L'ACTIVITÉ */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsActivityOpen(!isActivityOpen)}
              className="w-9 h-9 rounded-full bg-[#F5EFE0] grid place-items-center shrink-0 hover:opacity-90 active:scale-95 transition cursor-pointer"
              aria-label="Changer d'activité"
            >
              <Briefcase className="w-4 h-4 text-[#8B6F4A]" />
            </button>

            {isActivityOpen && (
              <>
                {/* Backdrop invisible pour intercepter les clics à l'extérieur */}
                <div className="fixed inset-0 z-45 bg-transparent" onClick={() => setIsActivityOpen(false)} />

                {/* Menu flottant */}
                <div className="absolute left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-brand-green/10 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150 text-brand-green">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-green/40 border-b border-brand-green/5">
                    Mes Activités
                  </div>

                  <div className="max-h-48 overflow-y-auto py-1">
                    {activities && activities.length > 0 ? (
                      activities.map((act: { id: string; name: string }) => {
                        const isSelected = act.id === activeId;
                        return (
                          <button
                            key={act.id}
                            type="button"
                            onClick={() => {
                              setActive(act.id);
                              setIsActivityOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between transition ${
                              isSelected ? "bg-[#1B3A2B] text-white" : "hover:bg-brand-sand/50 text-brand-green"
                            }`}
                          >
                            <span className="truncate">{act.name}</span>
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-brand-gold shrink-0 ml-2" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-3 py-2 text-xs text-brand-green/40 italic">Aucune activité trouvée</div>
                    )}
                  </div>

                  {/* Option pour aller à la configuration complète si besoin */}
                  <div className="border-t border-brand-green/5 p-1">
                    <Link
                      to="/settings/activities"
                      onClick={() => setIsActivityOpen(false)}
                      className="flex items-center justify-center gap-1 w-full text-center py-1.5 text-[11px] font-bold text-[#8B6F4A] hover:bg-brand-sand/30 rounded-lg transition"
                    >
                      <Plus className="w-3 h-3" /> Gérer les activités
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>

          <h1 className="text-center font-display text-[20px] font-bold tracking-[0.25em] text-brand-gold">AL-TOPPE</h1>
          <button
            type="button"
            onClick={speakSummary}
            aria-label="Écouter le résumé"
            className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 active:scale-95 grid place-items-center shrink-0 transition"
          >
            {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Period tabs */}
        <div className="grid grid-cols-3 mb-4 border-b border-white/10">
          {periods.map((p) => {
            const active = period === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`relative py-2 text-[11px] font-bold uppercase tracking-wider transition ${
                  active ? "text-brand-gold" : "text-white/55 hover:text-white/80"
                }`}
              >
                {p.label}
                {active && (
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-0 w-10 h-[2px] bg-brand-gold rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* GAIN DISPONIBLE */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gold">
              {isNegative ? "Résultat négatif" : "Gain disponible"}
            </p>
            <button
              type="button"
              onClick={() => setIsHidden((v) => !v)}
              aria-label={isHidden ? "Afficher" : "Masquer"}
              className="text-white/70 hover:text-white"
            >
              {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="font-display text-[40px] leading-none font-bold tracking-tight">
            {isHidden ? "••••••" : formatXOF(isNegative ? totals.gain : totals.available)}
          </p>
        </div>

        {/* Entrées / Sorties */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="rounded-2xl px-3 py-2 bg-[#3C7A52]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/90 mb-0.5">Entrées</p>
            <p className="font-display text-base font-bold text-white leading-tight">
              {isHidden ? "••••••" : formatXOF(totals.income)}
            </p>
          </div>
          <div className="rounded-2xl px-3 py-2 bg-[#C97B5F]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/95 mb-0.5">Sorties</p>
            <p className="font-display text-base font-bold text-white leading-tight">
              {isHidden ? "••••••" : `−${formatXOF(totals.expense)}`}
            </p>
          </div>
        </div>

        {/* Santé financière */}
        <div className="rounded-full bg-black/15 px-3 py-1.5 flex items-center gap-3">
          <p className="text-[10px] font-bold text-brand-gold whitespace-nowrap">Santé financière</p>
          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-gold to-[#3C7A52]"
              style={{ width: `${Math.min(100, Math.abs(totals.health))}%` }}
            />
          </div>
          <p className="font-display text-xs font-bold text-brand-gold tabular-nums">
            {totals.health > 0 ? "+" : ""}
            {totals.health}%
          </p>
        </div>
      </header>

      {/* ===== BODY ===== */}
      <section className="px-4 -mt-3 space-y-3">
        {pending.length > 0 && (
          <div className="bg-brand-terracotta/10 border border-brand-terracotta/30 rounded-2xl p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta mb-1">
              À valider ({pending.length})
            </p>
            <Link to="/transactions" className="text-xs font-semibold text-brand-terracotta hover:underline">
              Vérifier maintenant →
            </Link>
          </div>
        )}

        {/* Créances en cours */}
        <Link
          to="/receivables"
          className="block bg-white rounded-[20px] px-3 py-2.5 shadow-[0_4px_14px_rgba(27,58,43,0.08)] hover:shadow-[0_6px_18px_rgba(27,58,43,0.12)] transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#F7DCD4] grid place-items-center shrink-0">
              <HandCoins className="w-5 h-5 text-[#C97B5F]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-green/60">Créances en cours</p>
              <p className="font-display text-lg font-bold text-brand-green leading-tight">
                {formatXOF(receivablesQ.data?.totalDue ?? 0)}
              </p>
              <p className="text-[11px] text-brand-green/50 leading-tight">
                {receivablesQ.data?.receivables.length ?? 0} facture(s) à encaisser
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-[#C97B5F] shrink-0" />
          </div>
        </Link>

        {/* Mouvements récents header */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <h3 className="font-display text-base font-bold text-brand-green whitespace-nowrap">Mouvements récents</h3>
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/voice-history"
              className="text-[11px] text-brand-green/60 hover:text-brand-green hover:underline whitespace-nowrap"
            >
              Historique vocal
            </Link>
            <Link
              to="/transactions"
              className="text-[10px] font-bold uppercase tracking-wider text-white bg-[#1B3A2B] px-3 py-1.5 rounded-full hover:opacity-90 transition whitespace-nowrap"
            >
              Voir tout
            </Link>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <p className="text-sm text-brand-green/60 mb-4">Aucune transaction pour le moment.</p>
            <Link
              to="/transactions"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-terracotta"
            >
              <Plus className="w-4 h-4" /> Ajouter votre première
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-[20px] p-3 shadow-[0_4px_14px_rgba(27,58,43,0.06)] space-y-3">
            {Array.from(groups.entries()).map(([key, items]) => {
              const dt = new Date(items[0].occurred_at);
              return (
                <div key={key}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-green/50 px-1 mb-1.5">
                    {formatDateGroup(dt, today)}
                  </p>
                  <div className="bg-[#F1E9D8] rounded-2xl divide-y divide-[#E0D5B8]/60 overflow-hidden">
                    {items.map((t) => {
                      const vis = categoryVisual(t.category, t.type === "IN" ? "IN" : "OUT");
                      const showInvoice = t.type === "IN" && !(t as { is_personal?: boolean }).is_personal;
                      return (
                        <div key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              setReceiptTxn({
                                id: t.id,
                                type: t.type === "IN" ? "IN" : "OUT",
                                amount: t.amount,
                                label: t.label ?? null,
                                third_party: (t as { third_party?: string | null }).third_party ?? null,
                                category: t.category ?? null,
                                occurred_at: t.occurred_at,
                                is_credit: (t as { is_credit?: boolean }).is_credit ?? false,
                                source: t.source ?? null,
                                pos_name: (t as { pos_name?: string | null }).pos_name ?? null,
                                seller_name: (t as { seller_name?: string | null }).seller_name ?? null,
                              })
                            }
                            className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-70"
                          >
                            <div className={`w-10 h-10 rounded-full ${vis.bg} grid place-items-center shrink-0`}>
                              <vis.Icon className={`w-5 h-5 ${vis.fg}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-brand-green truncate">
                                {t.label || t.category || "Sans libellé"}
                              </p>
                              <span className="inline-block mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-brand-green/60 bg-[#E8E0D0] px-2 py-0.5 rounded-full">
                                {t.category?.trim() ? t.category : "Autre"}
                              </span>
                            </div>
                          </button>

                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <p
                              className={`font-display font-bold text-sm tabular-nums ${
                                t.type === "IN" ? "text-[#3C7A52]" : "text-[#C97B5F]"
                              }`}
                            >
                              {t.type === "IN" ? "+" : "−"}
                              {formatXOF(Number(t.amount))}
                            </p>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label="Voir le reçu"
                                title="Voir le reçu"
                                onClick={() =>
                                  setReceiptTxn({
                                    id: t.id,
                                    type: t.type === "IN" ? "IN" : "OUT",
                                    amount: t.amount,
                                    label: t.label ?? null,
                                    third_party: (t as { third_party?: string | null }).third_party ?? null,
                                    category: t.category ?? null,
                                    occurred_at: t.occurred_at,
                                    is_credit: (t as { is_credit?: boolean }).is_credit ?? false,
                                    source: t.source ?? null,
                                    pos_name: (t as { pos_name?: string | null }).pos_name ?? null,
                                    seller_name: (t as { seller_name?: string | null }).seller_name ?? null,
                                  })
                                }
                                className="w-7 h-7 grid place-items-center rounded-lg bg-white shadow-sm text-[#1B3A2B] hover:scale-105 hover:shadow-md active:scale-95 transition"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                              </button>
                              {showInvoice && (
                                <button
                                  type="button"
                                  aria-label="Voir la facture"
                                  title="Voir la facture"
                                  onClick={() => openInvoiceFor(t)}
                                  className="w-7 h-7 grid place-items-center rounded-lg bg-white shadow-sm text-[#C97B5F] hover:scale-105 hover:shadow-md active:scale-95 transition"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recording overlay */}
      {(recPhase === "recording" || recPhase === "sending") && (
        <div className="fixed inset-0 z-30 bg-brand-green/85 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-200">
          {recPhase === "recording" ? (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-gold mb-4">
                {locked ? "Enregistrement verrouillé" : "Enregistrement en cours"}
              </p>
              <div className="relative flex items-center justify-center mb-8">
                <span className="absolute w-48 h-48 rounded-full bg-brand-terracotta/30 animate-ping" />
                <span className="absolute w-36 h-36 rounded-full bg-brand-terracotta/40 animate-ping [animation-delay:200ms]" />
                <span className="absolute w-28 h-28 rounded-full bg-brand-terracotta/60 animate-pulse" />
                <div className="relative w-24 h-24 rounded-full bg-brand-terracotta flex items-center justify-center shadow-glow-terracotta">
                  <Mic className="w-10 h-10 text-white" />
                </div>
              </div>
              <p className="font-display text-5xl font-bold text-white tabular-nums mb-3">
                {recMM}:{recSS}
              </p>
              <p className="text-sm text-white/80 max-w-xs text-center px-6">
                {locked
                  ? "Appuyez sur le micro pour arrêter."
                  : "Relâchez pour envoyer · glissez vers le haut pour verrouiller"}
              </p>
            </>
          ) : (
            <>
              <Loader2 className="w-16 h-16 text-brand-gold animate-spin mb-6" />
              <p className="text-white/80 text-sm">Envoi en cours…</p>
            </>
          )}
        </div>
      )}

      {/* UNIQUE mic FAB */}
      <div className="fixed bottom-24 right-5 z-40 flex flex-col items-center select-none">
        {recPhase === "recording" && !locked && (
          <div
            className="mb-2 flex flex-col items-center text-white pointer-events-none"
            style={{ opacity: Math.min(1, 0.4 + dragY / LOCK_THRESHOLD) }}
          >
            <Lock className="w-4 h-4 mb-0.5" />
            <ChevronUp className="w-4 h-4 animate-bounce" />
          </div>
        )}
        <button
          type="button"
          onPointerDown={(e) => {
            if (recPhase !== "idle") return;
            e.preventDefault();
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            startYRef.current = e.clientY;
            setDragY(0);
            startRecording();
          }}
          onPointerMove={(e) => {
            if (recPhase !== "recording" || startYRef.current == null || locked) return;
            const dy = Math.max(0, startYRef.current - e.clientY);
            setDragY(dy);
            if (dy >= LOCK_THRESHOLD) setLocked(true);
          }}
          onPointerUp={() => {
            if (recPhase !== "recording" || locked) return;
            stopRecording(false);
          }}
          onPointerCancel={() => {
            if (recPhase !== "recording" || locked) return;
            stopRecording(true);
          }}
          onClick={() => {
            if (recPhase === "recording" && locked) stopRecording(false);
          }}
          onContextMenu={(e) => e.preventDefault()}
          disabled={recPhase === "sending"}
          aria-label={
            recPhase === "recording"
              ? locked
                ? "Arrêter l'enregistrement"
                : "Relâcher pour arrêter"
              : "Maintenir pour enregistrer"
          }
          className={`w-16 h-16 rounded-full text-black flex items-center justify-center transition-transform touch-none shadow-[0_8px_24px_rgba(201,130,31,0.55)] ${
            recPhase === "recording"
              ? "bg-brand-terracotta text-white animate-pulse"
              : "bg-gradient-to-br from-[#E0A938] to-[#C9821F] hover:scale-105"
          }`}
          style={
            recPhase === "recording" && !locked && dragY > 0
              ? { transform: `translateY(-${Math.min(dragY, LOCK_THRESHOLD)}px)` }
              : undefined
          }
        >
          {recPhase === "sending" ? (
            <Loader2 className="w-7 h-7 animate-spin" />
          ) : recPhase === "recording" && locked ? (
            <Square className="w-7 h-7" fill="currentColor" />
          ) : (
            <Mic className="w-7 h-7" />
          )}
        </button>
      </div>

      <TransactionReceiptSheet txn={receiptTxn} onClose={() => setReceiptTxn(null)} />

      <InvoiceModal
        lines={invoiceLines}
        onClose={() => setInvoiceLines(null)}
        companyName={companyName}
        companyPhone={companyPhone}
        companyNinea={companyNinea}
      />
    </div>
  );
}
