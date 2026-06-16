import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getMyStats } from "@/lib/settings.functions";
import { getContactStats } from "@/lib/contacts.functions";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/_unlocked/settings/stats")({
  component: StatsPage,
});

const COLORS = ["#1B4332", "#D97757", "#C9A227", "#6B8E23", "#7A4E2E", "#3B6FA0", "#9B72CF", "#4A6741"];

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " F";
}

const PERIODS: { label: string; days: number }[] = [
  { label: "7j", days: 7 },
  { label: "30j", days: 30 },
  { label: "90j", days: 90 },
  { label: "1 an", days: 365 },
];

function StatsPage() {
  const fetchStats = useServerFn(getMyStats);
  const fetchContactStats = useServerFn(getContactStats);
  const [days, setDays] = useState(90);
  const { data, isLoading } = useQuery({
    queryKey: ["my-stats", days],
    queryFn: () => fetchStats({ data: { days } }),
  });
  const cStatsQ = useQuery({
    queryKey: ["contact-stats", days],
    queryFn: () => fetchContactStats({ data: { days } }),
  });

  return (
    <div className="space-y-5 pb-6">
      <div className="flex gap-2 flex-wrap">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            onClick={() => setDays(p.days)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
              days === p.days ? "bg-brand-green text-white" : "bg-card border border-brand-green/10 text-brand-green/70"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <p className="text-sm text-brand-green/60">Chargement…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Kpi label="Entrées" value={formatXOF(data.totals.income)} color="text-success" />
            <Kpi label="Sorties" value={formatXOF(data.totals.expense)} color="text-brand-terracotta" />
            <Kpi label="Solde" value={formatXOF(data.totals.balance)} color="text-brand-green" />
          </div>

          <Card title="Évolution mensuelle">
            {data.monthly.length === 0 ? (
              <Empty />
            ) : (
              <div className="h-56">
                <ResponsiveContainer>
                  <LineChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatXOF(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="in" name="Entrées" stroke="#1B4332" strokeWidth={2} />
                    <Line type="monotone" dataKey="out" name="Sorties" stroke="#D97757" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="Dépenses par catégorie">
            {data.expensesByCategory.length === 0 ? <Empty /> : (
              <>
                <div className="h-56">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={data.expensesByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e) => `${Math.round((e.percent ?? 0) * 100)}%`} labelLine={false}>
                        {data.expensesByCategory.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatXOF(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <Legend2 items={data.expensesByCategory} total={data.totals.expense} />
              </>
            )}
          </Card>

          <Card title="Sources de revenus">
            {data.incomeByCategory.length === 0 ? <Empty /> : (
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={data.incomeByCategory.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip formatter={(v: number) => formatXOF(v)} />
                    <Bar dataKey="value" fill="#1B4332" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="Modes de saisie">
            <div className="space-y-2">
              {data.bySource.map((s) => {
                const pct = data.totals.count > 0 ? Math.round((s.value / data.totals.count) * 100) : 0;
                return (
                  <div key={s.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-brand-green/70">{s.name}</span>
                      <span className="text-brand-green font-semibold">{s.value} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-brand-sand rounded-full overflow-hidden">
                      <div className="h-full bg-brand-green" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {data.bySource.length === 0 && <Empty />}
            </div>
          </Card>

          <ContactRanking title="Top clients" items={cStatsQ.data?.clients ?? []} loading={cStatsQ.isLoading} color="#1B4332" />
          <ContactRanking title="Top fournisseurs" items={cStatsQ.data?.suppliers ?? []} loading={cStatsQ.isLoading} color="#D97757" />
        </>
      )}
    </div>
  );
}

type ContactStat = { name: string; count: number; total: number; avgTicket: number; intervalDays: number | null };

function ContactRanking({ title, items, loading, color }: { title: string; items: ContactStat[]; loading: boolean; color: string }) {
  const top = items.slice(0, 8);
  return (
    <Card title={title}>
      {loading ? (
        <p className="text-xs text-brand-green/40 text-center py-4">Chargement…</p>
      ) : top.length === 0 ? (
        <Empty />
      ) : (
        <>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={top} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                <Tooltip formatter={(v: number) => formatXOF(v)} />
                <Bar dataKey="total" fill={color} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1.5">
            {top.map((c) => (
              <div key={c.name} className="grid grid-cols-12 gap-2 text-[11px] items-center py-1 border-t border-brand-green/5 first:border-0">
                <span className="col-span-4 truncate text-brand-green font-semibold">{c.name}</span>
                <span className="col-span-3 text-right text-brand-green/70">{formatXOF(c.total)}</span>
                <span className="col-span-2 text-right text-brand-green/60">{c.count} tx</span>
                <span className="col-span-3 text-right text-brand-green/60">
                  ⌀ {formatXOF(Math.round(c.avgTicket))}
                  {c.intervalDays !== null && (
                    <span className="block text-[10px] text-brand-green/40">tous les {Math.round(c.intervalDays)}j</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-card rounded-2xl p-3 border border-brand-green/10">
      <p className="text-[9px] font-bold uppercase tracking-widest text-brand-green/50">{label}</p>
      <p className={`font-display text-sm font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl p-4 border border-brand-green/10">
      <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-green/60 mb-3">{title}</h4>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="text-xs text-brand-green/40 text-center py-6">Pas encore de données.</p>;
}

function Legend2({ items, total }: { items: { name: string; value: number }[]; total: number }) {
  return (
    <div className="mt-2 space-y-1">
      {items.slice(0, 6).map((it, i) => {
        const pct = total > 0 ? Math.round((it.value / total) * 100) : 0;
        return (
          <div key={it.name} className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="flex-1 truncate text-brand-green/70">{it.name}</span>
            <span className="text-brand-green font-semibold">{formatXOF(it.value)} ({pct}%)</span>
          </div>
        );
      })}
    </div>
  );
}
