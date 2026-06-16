import { ChevronDown, Check, Store, Pencil } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { usePOS, type POS } from "@/hooks/use-pos";

type Variant = "dark" | "light";

export function POSSwitcher({ variant = "dark" }: { variant?: Variant }) {
  const { pos, activePosId, setActivePos, isSeller } = usePOS();
  const navigate = useNavigate();
  const visible = pos.filter((p) => !p.is_archived);
  const active = pos.find((p) => p.id === activePosId) ?? visible[0];
  if (!active) return null;

  const styles =
    variant === "dark"
      ? "bg-white/15 hover:bg-white/25 text-white border border-white/20"
      : "bg-brand-green/10 hover:bg-brand-green/15 text-brand-green border border-brand-green/15";

  // Seller: just show their POS as a static badge
  if (isSeller) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${styles}`}
        title="Votre point de vente"
      >
        <Store className="w-3 h-3" />
        <span className="truncate max-w-[35vw]">{active.code} · {active.name}</span>
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition max-w-[45vw] ${styles}`}
          aria-label="Changer de point de vente"
        >
          <Store className="w-3 h-3 shrink-0" />
          <span className="truncate">{active.code}</span>
          <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-brand-green/60">
          Mes points de vente
        </DropdownMenuLabel>
        {visible.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={(e) => { e.preventDefault(); setActivePos(p.id); }}
            className="gap-2"
          >
            <span className="font-mono text-xs font-bold text-brand-terracotta w-10 shrink-0">{p.code}</span>
            <span className="flex-1 text-sm truncate">{p.name}</span>
            {p.id === activePosId && <Check className="w-4 h-4 text-brand-terracotta" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => { e.preventDefault(); navigate({ to: "/settings/points-de-vente" }); }}
          className="gap-2"
        >
          <Pencil className="w-4 h-4 text-brand-green/60" />
          <span className="text-sm">Gérer mes PV</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Coach-side picker, controlled by parent. */
export function CoachPOSPicker({
  pos,
  value,
  onChange,
}: {
  pos: POS[];
  value: string | "ALL";
  onChange: (v: string | "ALL") => void;
}) {
  const visible = pos.filter((p) => !p.is_archived);
  const current = value === "ALL" ? null : visible.find((p) => p.id === value) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-brand-green/10 hover:bg-brand-green/15 text-brand-green border border-brand-green/15">
          <Store className="w-3.5 h-3.5" />
          <span className="truncate max-w-[140px]">
            {current ? current.code : "Tous les PV"}
          </span>
          <ChevronDown className="w-3 h-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-brand-green/60">
          Code PV analysé
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onChange("ALL"); }} className="gap-2">
          <span className="font-mono text-xs font-bold text-brand-green/50 w-10 shrink-0">ALL</span>
          <span className="flex-1 text-sm">Tous les PV</span>
          {value === "ALL" && <Check className="w-4 h-4 text-brand-terracotta" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {visible.length === 0 ? (
          <p className="px-3 py-2 text-xs text-brand-green/60">Aucun PV.</p>
        ) : (
          visible.map((p) => (
            <DropdownMenuItem
              key={p.id}
              onSelect={(e) => { e.preventDefault(); onChange(p.id); }}
              className="gap-2"
            >
              <span className="font-mono text-xs font-bold text-brand-terracotta w-10 shrink-0">{p.code}</span>
              <span className="flex-1 text-sm truncate">{p.name}</span>
              {value === p.id && <Check className="w-4 h-4 text-brand-terracotta" />}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Small inline badge to tag a transaction with its PV code. */
export function POSBadge({ code }: { code: string | null | undefined }) {
  if (!code) return null;
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider bg-brand-green/10 text-brand-green px-1.5 py-0.5 rounded font-mono">
      <Store className="w-2.5 h-2.5" />
      {code}
    </span>
  );
}
