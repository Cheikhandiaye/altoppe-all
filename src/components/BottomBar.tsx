import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ListOrdered, Pencil, Settings as SettingsIcon } from "lucide-react";

type Item = {
  to: "/app" | "/transactions" | "/settings";
  label: string;
  icon: typeof Home;
  match: (path: string) => boolean;
  search?: Record<string, string>;
};

const ITEMS: Item[] = [
  { to: "/app", label: "Accueil", icon: Home, match: (p) => p === "/app" },
  {
    to: "/transactions",
    label: "Carnet",
    icon: ListOrdered,
    match: (p) => p === "/transactions" || p.startsWith("/receivables"),
  },
  {
    to: "/transactions",
    label: "Saisie",
    icon: Pencil,
    match: () => false,
    search: { new: "1" },
  },
  {
    to: "/settings",
    label: "Réglages",
    icon: SettingsIcon,
    match: (p) => p.startsWith("/settings"),
  },
];

export function BottomBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-0 left-0 right-0 z-30 pb-[env(safe-area-inset-bottom,0)] bg-brand-green rounded-t-[20px] shadow-[0_-4px_16px_rgba(0,0,0,0.18)]"
    >
      <div className="max-w-2xl mx-auto h-[68px] grid grid-cols-4">
        {ITEMS.map((it) => {
          const active = it.match(pathname);
          const Icon = it.icon;
          return (
            <Link
              key={it.label}
              to={it.to}
              search={it.search as never}
              className={`flex flex-col items-center justify-center gap-1 transition ${
                active ? "text-brand-gold" : "text-[#E8E0D0] hover:text-white"
              }`}
            >
              <span
                className={`grid place-items-center rounded-full transition ${
                  active ? "bg-white/10 w-9 h-9" : "w-9 h-9"
                }`}
              >
                <Icon className="w-5 h-5" />
              </span>
              <span className="text-[10px] font-semibold tracking-wide">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
