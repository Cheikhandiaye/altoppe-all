import { createFileRoute, Outlet, useRouter, useMatches, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_unlocked/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const router = useRouter();
  const matches = useMatches();
  const isHub = matches[matches.length - 1]?.routeId === "/_authenticated/_unlocked/settings/";

  return (
    <div className="min-h-screen bg-brand-sand pb-24">
      <header className="bg-brand-green text-white px-5 pt-6 pb-5 rounded-b-[2rem]">
        <div className="flex items-center gap-3">
          {!isHub ? (
            <button
              onClick={() => router.history.back()}
              className="p-2 -ml-2 rounded-full hover:bg-white/10"
              aria-label="Retour"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <Link to="/app" className="p-2 -ml-2 rounded-full hover:bg-white/10" aria-label="Accueil">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-gold">
              AL-TOPPE
            </p>
            <h1 className="font-display text-2xl font-bold">Paramètres</h1>
          </div>
        </div>
      </header>
      <main className="px-5 pt-6">
        <Outlet />
      </main>
    </div>
  );
}
