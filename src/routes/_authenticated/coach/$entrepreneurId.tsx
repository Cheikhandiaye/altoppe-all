import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Download, FileText, FileSpreadsheet, Sparkles, Save, LayoutGrid, ListChecks } from "lucide-react";
import {
  coachUpdateTransaction,
  getEntrepreneurDetail,
  exportIncomeStatement,
  exportTransactionsXlsx,
  getBMC,
  generateBMC,
  saveBMC,
} from "@/lib/coach.functions";
import { listEntrepreneurActivities } from "@/lib/activities.functions";
import { listEntrepreneurPOS } from "@/lib/pos.functions";
import { SYSCOHADA_CATEGORIES } from "@/lib/syscohada";
import { CoachActivityPicker } from "@/components/ActivitySwitcher";
import { CoachPOSPicker, POSBadge } from "@/components/POSSwitcher";

export const Route = createFileRoute("/_authenticated/coach/$entrepreneurId")({
  component: EntrepreneurDetail,
});

type Filter = { from: string; to: string; typeFilter: "ALL" | "IN" | "OUT"; activityId: string | "ALL"; posId: string | "ALL" };


const detailQuery = (id: string, f: Filter) =>
  queryOptions({
    queryKey: ["coach", "entrepreneur", id, f],
    queryFn: () =>
      getEntrepreneurDetail({
        data: {
          entrepreneurId: id,
          from: f.from ? new Date(f.from + "T00:00:00").toISOString() : undefined,
          to: f.to ? new Date(f.to + "T23:59:59").toISOString() : undefined,
          typeFilter: f.typeFilter,
          activityId: f.activityId,
          posId: f.posId,
        },
      }),
  });

const activitiesQuery = (id: string) =>
  queryOptions({
    queryKey: ["coach", "activities", id],
    queryFn: () => listEntrepreneurActivities({ data: { entrepreneurId: id } }),
  });

const posQuery = (id: string) =>
  queryOptions({
    queryKey: ["coach", "pos", id],
    queryFn: () => listEntrepreneurPOS({ data: { entrepreneurId: id } }),
  });


const bmcQuery = (id: string) =>
  queryOptions({
    queryKey: ["coach", "bmc", id],
    queryFn: () => getBMC({ data: { entrepreneurId: id } }),
  });

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " F";
}

function downloadBase64(base64: string, filename: string, mime: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function EntrepreneurDetail() {
  const { entrepreneurId } = Route.useParams();
  const [tab, setTab] = useState<"txn" | "bmc">("txn");
  const [filter, setFilter] = useState<Filter>({ from: "", to: "", typeFilter: "ALL", activityId: "ALL", posId: "ALL" });
  const fetchDetail = useServerFn(getEntrepreneurDetail);
  const fetchActivities = useServerFn(listEntrepreneurActivities);
  const fetchPOS = useServerFn(listEntrepreneurPOS);
  const update = useServerFn(coachUpdateTransaction);
  const exportFn = useServerFn(exportIncomeStatement);
  const exportXlsxFn = useServerFn(exportTransactionsXlsx);
  const qc = useQueryClient();
  const q = detailQuery(entrepreneurId, filter);
  const { data, isFetching } = useQuery({
    ...q,
    queryFn: () =>
      fetchDetail({
        data: {
          entrepreneurId,
          from: filter.from ? new Date(filter.from + "T00:00:00").toISOString() : undefined,
          to: filter.to ? new Date(filter.to + "T23:59:59").toISOString() : undefined,
          typeFilter: filter.typeFilter,
          activityId: filter.activityId,
          posId: filter.posId,
        },
      }),
  });
  const aq = activitiesQuery(entrepreneurId);
  const { data: activitiesData } = useQuery({
    ...aq,
    queryFn: () => fetchActivities({ data: { entrepreneurId } }),
  });
  const pq = posQuery(entrepreneurId);
  const { data: posData } = useQuery({
    ...pq,
    queryFn: () => fetchPOS({ data: { entrepreneurId } }),
  });
  const activities = activitiesData?.activities ?? [];
  const pos = posData?.pos ?? [];
  const posCodeById = new Map(pos.map((p) => [p.id, p.code]));

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "docx" | "xlsx" | null>(null);

  const onUpdate = async (
    id: string,
    patch: { category?: string | null; coach_note?: string | null; validate?: boolean },
  ) => {
    setPendingId(id);
    try {
      await update({ data: { transactionId: id, ...patch } });
      await qc.invalidateQueries({ queryKey: ["coach"] });
      toast.success("Mis à jour");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPendingId(null);
    }
  };

  const onExport = async (format: "pdf" | "docx") => {
    setExporting(format);
    try {
      const res = await exportFn({
        data: {
          entrepreneurId,
          from: filter.from ? new Date(filter.from + "T00:00:00").toISOString() : undefined,
          to: filter.to ? new Date(filter.to + "T23:59:59").toISOString() : undefined,
          typeFilter: filter.typeFilter,
          activityId: filter.activityId,
          posId: filter.posId,
          format,
        },
      });
      downloadBase64(res.base64, res.filename, res.mime);
      toast.success(`Compte de résultat ${format.toUpperCase()} téléchargé`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur export");
    } finally {
      setExporting(null);
    }
  };

  const onExportXlsx = async () => {
    setExporting("xlsx");
    try {
      const res = await exportXlsxFn({
        data: {
          entrepreneurId,
          from: filter.from ? new Date(filter.from + "T00:00:00").toISOString() : undefined,
          to: filter.to ? new Date(filter.to + "T23:59:59").toISOString() : undefined,
          typeFilter: filter.typeFilter,
          activityId: filter.activityId,
          posId: filter.posId,
        },
      });

      downloadBase64(res.base64, res.filename, res.mime);
      toast.success("Transactions exportées (Excel/CSV)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur export");
    } finally {
      setExporting(null);
    }
  };

  if (!data) {
    return (
      <div className="bg-card rounded-2xl p-10 text-center">
        <Loader2 className="w-6 h-6 mx-auto animate-spin text-brand-green/40" />
      </div>
    );
  }

  const { profile, transactions, totals } = data;
  const gainNegative = totals.gain < 0;

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border border-brand-green/10 p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta">
          Entrepreneur
        </p>
        <h2 className="font-display text-2xl font-bold text-brand-green mt-1">
          {profile.business_name || profile.full_name || "Sans nom"}
        </h2>
        <p className="text-xs text-brand-green/60 mt-1">
          {profile.full_name} · {profile.phone ?? "—"} · {profile.region ?? "—"} · {profile.sector ?? "—"}
        </p>

        {(activities.length > 0 || pos.length > 0) && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {activities.length > 0 && (
              <>
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green/50">
                  Activité
                </span>
                <CoachActivityPicker
                  activities={activities}
                  value={filter.activityId}
                  onChange={(v) => setFilter((f) => ({ ...f, activityId: v }))}
                />
              </>
            )}
            {pos.length > 0 && (
              <>
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green/50">
                  PV
                </span>
                <CoachPOSPicker
                  pos={pos}
                  value={filter.posId}
                  onChange={(v) => setFilter((f) => ({ ...f, posId: v }))}
                />
              </>
            )}
          </div>
        )}


        {/* Tabs */}
        <div className="mt-5 flex gap-1 border-b border-brand-green/10">
          <TabBtn active={tab === "txn"} onClick={() => setTab("txn")} icon={<ListChecks className="w-3.5 h-3.5" />}>
            Transactions
          </TabBtn>
          <TabBtn active={tab === "bmc"} onClick={() => setTab("bmc")} icon={<LayoutGrid className="w-3.5 h-3.5" />}>
            Business Model Canvas
          </TabBtn>
        </div>
      </div>

      {tab === "txn" && (
        <>
          {/* Filters */}
          <div className="bg-card rounded-2xl border border-brand-green/10 p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-green/60 mb-1">
                Du
              </label>
              <input
                type="date"
                value={filter.from}
                onChange={(e) => setFilter((f) => ({ ...f, from: e.target.value }))}
                className="bg-brand-sand rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-green/60 mb-1">
                Au
              </label>
              <input
                type="date"
                value={filter.to}
                onChange={(e) => setFilter((f) => ({ ...f, to: e.target.value }))}
                className="bg-brand-sand rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-brand-green/60 mb-1">
                Type
              </label>
              <div className="inline-flex rounded-lg bg-brand-sand p-0.5">
                {(["ALL", "IN", "OUT"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter((f) => ({ ...f, typeFilter: t }))}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      filter.typeFilter === t
                        ? t === "IN"
                          ? "bg-success text-white"
                          : t === "OUT"
                            ? "bg-destructive text-white"
                            : "bg-brand-green text-white"
                        : "text-brand-green/70 hover:text-brand-green"
                    }`}
                  >
                    {t === "ALL" ? "Tout" : t === "IN" ? "Entrées" : "Sorties"}
                  </button>
                ))}
              </div>
            </div>
            {(filter.from || filter.to || filter.typeFilter !== "ALL") && (
              <button
                onClick={() => setFilter({ from: "", to: "", typeFilter: "ALL", activityId: "ALL", posId: "ALL" })}
                className="text-xs text-brand-terracotta font-semibold hover:underline"
              >
                Réinitialiser
              </button>
            )}
            <div className="flex-1" />
            <div className="flex gap-2">
              <button
                onClick={() => onExport("pdf")}
                disabled={exporting !== null}
                className="inline-flex items-center gap-1.5 bg-brand-green text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-brand-green-soft disabled:opacity-50"
              >
                {exporting === "pdf" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                PDF
              </button>
              <button
                onClick={() => onExport("docx")}
                disabled={exporting !== null}
                className="inline-flex items-center gap-1.5 bg-brand-terracotta text-white text-xs font-semibold px-3 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {exporting === "docx" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                Word
              </button>
              <button
                onClick={onExportXlsx}
                disabled={exporting !== null}
                className="inline-flex items-center gap-1.5 bg-brand-gold text-brand-green text-xs font-semibold px-3 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
                title="Exporter les transactions de la période en Excel/CSV"
              >
                {exporting === "xlsx" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                Excel
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Recettes" value={formatXOF(totals.income)} />
            <Stat label="Dépenses" value={formatXOF(totals.expense)} />
            <Stat
              label="Gain"
              value={formatXOF(totals.gain)}
              highlight
              negative={gainNegative}
            />
          </div>

          {/* Transactions */}
          <div className="bg-card rounded-2xl border border-brand-green/10 overflow-hidden">
            <div className="px-5 py-3 border-b border-brand-green/10 flex justify-between items-center">
              <h3 className="font-display font-bold text-brand-green">Transactions</h3>
              <p className="text-[11px] text-brand-green/50">
                {isFetching ? "Chargement…" : `${transactions.length} résultat(s)`}
              </p>
            </div>
            {transactions.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-brand-green/60">
                Aucune transaction pour ce filtre.
              </p>
            ) : (
              <ul>
                {transactions.map((t) => {
                  const isDraft = t.validation_status === "A_VALIDER";
                  return (
                    <li
                      key={t.id}
                      className={`px-5 py-3 border-t border-brand-green/5 first:border-t-0 ${
                        isDraft ? "bg-brand-terracotta/[0.03]" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <p className="font-semibold text-brand-green text-sm truncate">
                              {t.label || "Sans libellé"}
                            </p>
                            {isDraft && (
                              <span className="text-[9px] font-bold uppercase tracking-wider bg-brand-terracotta/15 text-brand-terracotta px-1.5 py-0.5 rounded">
                                Brouillon
                              </span>
                            )}
                            {t.source === "VOICE" && (
                              <span className="text-[9px] font-bold uppercase tracking-wider bg-brand-green/10 text-brand-green px-1.5 py-0.5 rounded">
                                Voix
                              </span>
                            )}
                            {t.is_personal && (
                              <span className="text-[9px] font-bold uppercase tracking-wider bg-brand-gold/30 text-brand-green px-1.5 py-0.5 rounded">
                                Privé
                              </span>
                            )}
                            {t.pos_id && <POSBadge code={posCodeById.get(t.pos_id) ?? null} />}

                          </div>
                          <p className="text-[11px] text-brand-green/50 mt-0.5">
                            {new Date(t.occurred_at).toLocaleDateString("fr-FR")} · {t.source} ·{" "}
                            {t.third_party ?? "—"}
                          </p>
                        </div>

                        <select
                          value={t.category ?? ""}
                          disabled={pendingId === t.id}
                          onChange={(e) => onUpdate(t.id, { category: e.target.value || null })}
                          className="text-xs bg-brand-sand rounded-lg px-2 py-1.5 max-w-[180px]"
                        >
                          <option value="">— Catégorie —</option>
                          {SYSCOHADA_CATEGORIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.code} · {c.label}
                            </option>
                          ))}
                        </select>

                        <p
                          className={`font-display font-bold text-sm w-24 text-right ${
                            t.type === "IN" ? "text-success" : "text-brand-terracotta"
                          }`}
                        >
                          {t.type === "IN" ? "+" : "−"}
                          {formatXOF(Number(t.amount))}
                        </p>

                        {isDraft && (
                          <button
                            onClick={() => onUpdate(t.id, { validate: true })}
                            disabled={pendingId === t.id}
                            className="p-2 rounded-lg bg-brand-green text-white hover:bg-brand-green-soft disabled:opacity-50"
                            aria-label="Valider"
                          >
                            {pendingId === t.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>

                      {!isDraft && t.coach_note && (
                        <p className="mt-1 text-[11px] text-brand-green/60 italic">
                          Note coach : {t.coach_note}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      {tab === "bmc" && <BMCPanel entrepreneurId={entrepreneurId} />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition ${
        active
          ? "border-brand-terracotta text-brand-green"
          : "border-transparent text-brand-green/50 hover:text-brand-green"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function Stat({
  label,
  value,
  highlight,
  negative,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  negative?: boolean;
}) {
  const bg = highlight
    ? negative
      ? "bg-destructive text-white"
      : "bg-brand-green text-white"
    : "bg-brand-sand";
  const labelColor = highlight
    ? negative
      ? "text-white/80"
      : "text-brand-gold"
    : "text-brand-green/60";
  return (
    <div className={`rounded-xl p-3 ${bg}`}>
      <p className={`text-[10px] font-bold uppercase tracking-widest ${labelColor}`}>{label}</p>
      <p className="font-display text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

// ============== BMC ==============

const BMC_BLOCKS: Array<{ key: BMCKey; label: string; hint: string }> = [
  { key: "key_partners", label: "Partenaires clés", hint: "Fournisseurs, alliés, sous-traitants" },
  { key: "key_activities", label: "Activités clés", hint: "Production, vente, logistique…" },
  { key: "key_resources", label: "Ressources clés", hint: "Humaines, matérielles, financières" },
  { key: "value_propositions", label: "Proposition de valeur", hint: "Ce qui rend l'offre unique" },
  { key: "customer_relationships", label: "Relation client", hint: "Comment fidéliser" },
  { key: "channels", label: "Canaux", hint: "Comment atteindre le client" },
  { key: "customer_segments", label: "Segments de clientèle", hint: "À qui on vend" },
  { key: "cost_structure", label: "Structure de coûts", hint: "Principaux postes de dépenses" },
  { key: "revenue_streams", label: "Sources de revenus", hint: "Comment l'argent rentre" },
];

type BMCKey =
  | "key_partners"
  | "key_activities"
  | "key_resources"
  | "value_propositions"
  | "customer_relationships"
  | "channels"
  | "customer_segments"
  | "cost_structure"
  | "revenue_streams";

type BMCState = Record<BMCKey, string> & { activity_description: string };

function emptyBMC(): BMCState {
  return {
    activity_description: "",
    key_partners: "",
    key_activities: "",
    key_resources: "",
    value_propositions: "",
    customer_relationships: "",
    channels: "",
    customer_segments: "",
    cost_structure: "",
    revenue_streams: "",
  };
}

function BMCPanel({ entrepreneurId }: { entrepreneurId: string }) {
  const fetchBMC = useServerFn(getBMC);
  const generate = useServerFn(generateBMC);
  const save = useServerFn(saveBMC);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    ...bmcQuery(entrepreneurId),
    queryFn: () => fetchBMC({ data: { entrepreneurId } }),
  });

  const [state, setState] = useState<BMCState | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Hydrate state when data arrives or changes
  const serverData = data?.bmc;
  const initial = serverData
    ? ({
        activity_description: serverData.activity_description ?? "",
        key_partners: serverData.key_partners ?? "",
        key_activities: serverData.key_activities ?? "",
        key_resources: serverData.key_resources ?? "",
        value_propositions: serverData.value_propositions ?? "",
        customer_relationships: serverData.customer_relationships ?? "",
        channels: serverData.channels ?? "",
        customer_segments: serverData.customer_segments ?? "",
        cost_structure: serverData.cost_structure ?? "",
        revenue_streams: serverData.revenue_streams ?? "",
      } satisfies BMCState)
    : emptyBMC();

  const current = state ?? initial;

  const setField = (k: keyof BMCState, v: string) => setState({ ...current, [k]: v });

  const onGenerate = async () => {
    if (current.activity_description.trim().length < 20) {
      toast.error("Décrivez l'activité en au moins 20 caractères.");
      return;
    }
    setGenerating(true);
    try {
      const res = await generate({
        data: { entrepreneurId, activity_description: current.activity_description },
      });
      setState({ ...current, ...(res.bmc as Partial<BMCState>) } as BMCState);
      await qc.invalidateQueries({ queryKey: ["coach", "bmc", entrepreneurId] });
      toast.success("BMC généré par l'IA");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur IA");
    } finally {
      setGenerating(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await save({ data: { entrepreneurId, ...current } });
      await qc.invalidateQueries({ queryKey: ["coach", "bmc", entrepreneurId] });
      setState(null);
      toast.success("BMC enregistré");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl p-10 text-center">
        <Loader2 className="w-6 h-6 mx-auto animate-spin text-brand-green/40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-brand-green/10 p-5 space-y-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-brand-green/70 mb-2">
            Description détaillée de l'activité
          </label>
          <textarea
            value={current.activity_description}
            onChange={(e) => setField("activity_description", e.target.value)}
            rows={5}
            placeholder="Ex : Boutique de vente de poisson frais à Pikine. Achète au port de Dakar tous les matins, revend aux ménagères et restaurants du quartier. Emploie 2 vendeurs, livre à moto…"
            className="w-full text-sm bg-brand-sand rounded-lg p-3 border border-brand-green/10 focus:outline-none focus:border-brand-green"
          />
          <p className="text-[11px] text-brand-green/50 mt-1">
            Plus la description est riche, meilleur sera le BMC généré par l'IA.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onGenerate}
            disabled={generating}
            className="inline-flex items-center gap-1.5 bg-brand-terracotta text-white text-xs font-semibold px-3 py-2 rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {serverData ? "Régénérer avec l'IA" : "Générer avec l'IA"}
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-brand-green text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-brand-green-soft disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Enregistrer
          </button>
          {state && (
            <button
              onClick={() => setState(null)}
              className="text-xs text-brand-green/60 font-semibold hover:underline"
            >
              Annuler les modifications
            </button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {BMC_BLOCKS.map((b) => (
          <div
            key={b.key}
            className="bg-card rounded-2xl border border-brand-green/10 p-3 flex flex-col"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-terracotta">
              {b.label}
            </p>
            <p className="text-[10px] text-brand-green/50 mt-0.5 mb-2">{b.hint}</p>
            <textarea
              value={current[b.key]}
              onChange={(e) => setField(b.key, e.target.value)}
              rows={6}
              className="flex-1 text-xs bg-brand-sand rounded-lg p-2 border border-brand-green/10 focus:outline-none focus:border-brand-green resize-none"
              placeholder="• …"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
