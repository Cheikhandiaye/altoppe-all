import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { ShieldCheck, BarChart3, Settings2 } from "lucide-react";
import { getMyRoles } from "@/lib/roles.functions";
import { isStandalonePWA } from "@/lib/pwa";

const rolesQuery = queryOptions({ queryKey: ["my-roles"], queryFn: () => getMyRoles() });

export const Route = createFileRoute("/_authenticated/admin")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(rolesQuery);
  },
  component: AdminLayout,
});

function AdminLayout() {
  const fetchRoles = useServerFn(getMyRoles);
  const { data: roles } = useSuspenseQuery({ ...rolesQuery, queryFn: () => fetchRoles() });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // L'espace admin est réservé au desktop : depuis la PWA mobile, on renvoie vers /app
  useEffect(() => {
    if (isStandalonePWA()) {
      window.location.replace("/app");
    }
  }, []);

  if (!roles.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <ShieldCheck className="w-12 h-12 mx-auto text-brand-terracotta mb-3" />
          <h2 className="font-display text-2xl font-bold text-brand-green">Accès admin requis</h2>
          <Link to="/app" className="inline-block mt-6 text-sm font-semibold text-brand-terracotta">
            ← Retour
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    { to: "/admin", label: "Tableau de bord", icon: BarChart3, exact: true },
    { to: "/admin/parametrages", label: "Paramétrages", icon: Settings2, exact: false },
  ] as const;

  return (
    <div className="min-h-screen bg-brand-sand">
      <header className="bg-brand-green text-white px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-gold">
              AL-TOPPE — Admin
            </p>
            <h1 className="font-display text-2xl font-bold">Backoffice administrateur</h1>
          </div>
          <nav className="flex items-center gap-4 text-xs font-semibold uppercase tracking-wider">
            <Link to="/coach" className="text-white/70 hover:text-brand-gold">
              Coach
            </Link>
            <Link to="/app" className="text-white/70 hover:text-brand-gold">
              Mon compte
            </Link>
          </nav>
        </div>
        <div className="max-w-6xl mx-auto mt-5 flex gap-1 flex-wrap">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-xs font-bold uppercase tracking-wider transition ${
                  active
                    ? "bg-brand-sand text-brand-green"
                    : "bg-brand-green/40 text-white/80 hover:bg-brand-green/60"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
