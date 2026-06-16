import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { listAssignedEntrepreneurs } from "@/lib/coach.functions";
import { getMyRoles } from "@/lib/roles.functions";
import { isStandalonePWA } from "@/lib/pwa";
import { Users, ChevronRight, ShieldCheck } from "lucide-react";

const rolesQuery = queryOptions({ queryKey: ["my-roles"], queryFn: () => getMyRoles() });
const listQuery = queryOptions({
  queryKey: ["coach", "assigned"],
  queryFn: () => listAssignedEntrepreneurs(),
});

export const Route = createFileRoute("/_authenticated/coach")({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(rolesQuery),
      context.queryClient.ensureQueryData(listQuery),
    ]);
  },
  component: CoachLayout,
});

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " F";
}

function CoachLayout() {
  const fetchRoles = useServerFn(getMyRoles);
  const fetchList = useServerFn(listAssignedEntrepreneurs);
  const { data: roles } = useSuspenseQuery({ ...rolesQuery, queryFn: () => fetchRoles() });
  const { data } = useSuspenseQuery({ ...listQuery, queryFn: () => fetchList() });

  // L'espace coach est réservé au desktop : depuis la PWA mobile, on renvoie vers /app
  useEffect(() => {
    if (isStandalonePWA()) {
      window.location.replace("/app");
    }
  }, []);

  if (!roles.isCoach && !roles.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <ShieldCheck className="w-12 h-12 mx-auto text-brand-terracotta mb-3" />
          <h2 className="font-display text-2xl font-bold text-brand-green">Accès coach requis</h2>
          <p className="text-sm text-brand-green/60 mt-2">
            Demandez à un administrateur de vous attribuer le rôle de coach.
          </p>
          <Link to="/app" className="inline-block mt-6 text-sm font-semibold text-brand-terracotta">
            ← Retour à l'application
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-sand">
      <header className="bg-brand-green text-white px-6 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-gold">
              Backoffice coach
            </p>
            <h1 className="font-display text-2xl font-bold">AL-TOPPE — Coach</h1>
          </div>
          <nav className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wider">
            {roles.isAdmin && (
              <Link to="/admin" className="text-white/70 hover:text-brand-gold">
                Admin
              </Link>
            )}
            <Link to="/app" className="text-white/70 hover:text-brand-gold">
              Mon compte
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 grid md:grid-cols-[320px_1fr] gap-6">
        <aside className="bg-card rounded-2xl border border-brand-green/10 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-brand-terracotta" />
            <h2 className="font-display font-bold text-sm text-brand-green">
              Mes entrepreneurs ({data.entrepreneurs.length})
            </h2>
          </div>
          {data.entrepreneurs.length === 0 ? (
            <p className="text-xs text-brand-green/60 px-2 py-4">
              Aucun entrepreneur ne vous est assigné pour le moment.
            </p>
          ) : (
            <ul className="space-y-1">
              {data.entrepreneurs.map((e) => {
                const negative = (e.gain ?? 0) < 0;
                return (
                  <li key={e.id}>
                    <Link
                      to="/coach/$entrepreneurId"
                      params={{ entrepreneurId: e.id }}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm group border-l-4 ${
                        negative
                          ? "border-destructive bg-destructive/5 hover:bg-destructive/10 text-destructive"
                          : "border-transparent hover:bg-brand-sand"
                      }`}
                      activeProps={{
                        className: negative
                          ? "bg-destructive text-white border-destructive hover:bg-destructive"
                          : "bg-brand-green text-white border-brand-green hover:bg-brand-green",
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">
                          {e.business_name || e.full_name || "Sans nom"}
                        </p>
                        <p className="text-[10px] opacity-70 truncate">
                          {e.region ?? "—"} · {formatXOF(e.gain ?? 0)}
                          {(e.pending ?? 0) > 0 && (
                            <span className="ml-2 font-bold">
                              • {e.pending} à valider
                            </span>
                          )}
                        </p>
                      </div>
                      <ChevronRight className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section>
          <Outlet />
        </section>
      </main>
    </div>
  );
}
