import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { adminFilterOptions, adminMetrics } from "@/lib/admin.functions";
import {
  Users,
  Activity,
  TrendingUp,
  TrendingDown,
  Wallet,
  Mic,
  Receipt,
  Trophy,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: DashboardPage,
});

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " F";
}
function formatPct(n: number) {
  return (n * 100).toFixed(0) + "%";
}

function DashboardPage() {
  const fetchOpts = useServerFn(adminFilterOptions);
  const fetchMetrics = useServerFn(adminMetrics);

  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [region, setRegion] = useState<string>("");
  const [sector, setSector] = useState<string>("");
  const [coachId, setCoachId] = useState<string>("");

  const filters = useMemo(
    () => ({
      from: from ? new Date(from).toISOString() : null,
      to: to ? new Date(to + "T23:59:59").toISOString() : null,
      region: region || null,
      sector: sector || null,
      coachId: coachId || null,
    }),
    [from, to, region, sector, coachId],
  );

  const optsQ = useQuery({
    queryKey: ["admin", "filter-options"],
    queryFn: () => fetchOpts(),
  });
  const metricsQ = useQuery({
    queryKey: ["admin", "metrics", filters],
    queryFn: () => fetchMetrics({ data: filters }),
  });

  const m = metricsQ.data;
  const opts = optsQ.data;

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <section className="bg-card rounded-2xl border border-brand-green/10 p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <Field label="Du">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full bg-brand-sand rounded-lg px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Au">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full bg-brand-sand rounded-lg px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Région">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full bg-brand-sand rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Toutes</option>
              {opts?.regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Secteur">
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full bg-brand-sand rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Tous</option>
              {opts?.sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Coach">
            <select
              value={coachId}
              onChange={(e) => setCoachId(e.target.value)}
              className="w-full bg-brand-sand rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Tous</option>
              {opts?.coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {(from || to || region || sector || coachId) && (
          <button
            onClick={() => {
              setFrom("");
              setTo("");
              setRegion("");
              setSector("");
              setCoachId("");
            }}
            className="mt-3 text-xs font-bold uppercase tracking-wider text-brand-terracotta hover:underline"
          >
            Réinitialiser les filtres
          </button>
        )}
      </section>

      {metricsQ.isLoading || !m ? (
        <p className="text-sm text-brand-green/60">Chargement des indicateurs…</p>
      ) : (
        <>
          {/* KPIs Financiers */}
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-green/60 mb-2">
              Indicateurs financiers globaux
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi icon={TrendingUp} label="Volume CA total" value={formatXOF(m.kpis.income)} />
              <Kpi icon={TrendingDown} label="Volume charges" value={formatXOF(m.kpis.expense)} />
              <Kpi
                icon={Wallet}
                label="Solde global"
                value={formatXOF(m.kpis.gain)}
                highlight={m.kpis.gain >= 0}
                negative={m.kpis.gain < 0}
              />
              <Kpi icon={Receipt} label="Ticket moyen" value={formatXOF(m.kpis.avgTicket)} />
            </div>
          </section>

          {/* Adoption */}
          <section>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-green/60 mb-2">
              Adoption & utilisation
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Kpi icon={Users} label="Profils total" value={String(m.kpis.totalUsers)} />
              <Kpi
                icon={Activity}
                label="Actifs 7 jours"
                value={`${m.kpis.active7} / ${m.kpis.totalUsers}`}
              />
              <Kpi
                icon={Activity}
                label="Actifs 30 jours"
                value={`${m.kpis.active30} / ${m.kpis.totalUsers}`}
              />
              <Kpi
                icon={Mic}
                label="Saisie vocale"
                value={formatPct(m.kpis.voiceShare)}
              />
            </div>
          </section>

          {/* Évolution mensuelle */}
          <section className="bg-card rounded-2xl border border-brand-green/10 p-5">
            <h3 className="font-display font-bold text-brand-green mb-4">
              Évolution sur 12 mois (recettes / charges)
            </h3>
            <MonthlyChart data={m.monthlySeries} />
          </section>

          <div className="grid md:grid-cols-2 gap-4">
            <Distribution title="Répartition du CA par secteur" data={m.incomeBySector} format="money" />
            <Distribution title="Top catégories de dépenses" data={m.expenseByCategory} format="money" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Distribution title="Entreprises par région" data={m.byRegion} />
            <Distribution title="Entreprises par secteur" data={m.bySector} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <TopList
              title="Palmarès des ventes (Top 10)"
              icon={Trophy}
              items={m.topByRevenue.map((t) => ({ id: t.id, name: t.name, value: formatXOF(t.amount) }))}
            />
            <TopList
              title="Top assiduité comptable (Top 10)"
              icon={Trophy}
              items={m.topByActivity.map((t) => ({ id: t.id, name: t.name, value: `${t.count} opé.` }))}
            />
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest text-brand-green/60 block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  highlight,
  negative,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
  negative?: boolean;
}) {
  const bg = negative
    ? "bg-brand-terracotta text-white"
    : highlight
      ? "bg-brand-green text-white"
      : "bg-card border border-brand-green/10";
  const labelColor = negative || highlight ? "text-brand-gold" : "text-brand-green/60";
  return (
    <div className={`rounded-2xl p-4 ${bg}`}>
      <div className="flex items-center justify-between">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${labelColor}`}>{label}</p>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      <p className="font-display text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function Distribution({
  title,
  data,
  format,
}: {
  title: string;
  data: Record<string, number>;
  format?: "money";
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="bg-card rounded-2xl border border-brand-green/10 p-5">
      <h3 className="font-display font-bold text-brand-green mb-3">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-xs text-brand-green/60">Aucune donnée</p>
      ) : (
        <ul className="space-y-2">
          {entries.map(([k, v]) => (
            <li key={k} className="text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-brand-green truncate pr-2">{k}</span>
                <span className="font-display font-bold text-brand-green whitespace-nowrap">
                  {format === "money" ? formatXOF(v) : v}
                </span>
              </div>
              <div className="h-1.5 bg-brand-sand rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-terracotta"
                  style={{ width: `${(v / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TopList({
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { id: string; name: string; value: string }[];
}) {
  return (
    <div className="bg-card rounded-2xl border border-brand-green/10 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-brand-gold" />
        <h3 className="font-display font-bold text-brand-green">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-brand-green/60">Aucune donnée</p>
      ) : (
        <ol className="space-y-1">
          {items.map((it, i) => (
            <li key={it.id} className="flex items-center justify-between text-sm py-1">
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold w-5 text-brand-green/40">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-brand-green truncate">{it.name}</span>
              </span>
              <span className="font-display font-bold text-brand-green whitespace-nowrap pl-2">
                {it.value}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function MonthlyChart({ data }: { data: { month: string; in: number; out: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.in, d.out)));
  return (
    <div>
      <div className="flex items-end gap-1 h-40">
        {data.map((d) => (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="flex items-end gap-0.5 w-full h-full">
              <div
                className="flex-1 bg-brand-green rounded-t"
                style={{ height: `${(d.in / max) * 100}%` }}
                title={`Recettes : ${formatXOF(d.in)}`}
              />
              <div
                className="flex-1 bg-brand-terracotta rounded-t"
                style={{ height: `${(d.out / max) * 100}%` }}
                title={`Charges : ${formatXOF(d.out)}`}
              />
            </div>
            <span className="text-[9px] text-brand-green/50">{d.month.slice(5)}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-3 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-brand-green rounded-sm" /> Recettes
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-brand-terracotta rounded-sm" /> Charges
        </span>
      </div>
    </div>
  );
}
