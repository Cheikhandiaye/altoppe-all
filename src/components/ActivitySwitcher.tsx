import { useState } from "react";
import { ChevronDown, Plus, Check, Pencil } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useActiveActivity, type Activity } from "@/hooks/use-active-activity";
import { useServerFn } from "@tanstack/react-start";
import { createActivity } from "@/lib/activities.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const EMOJI_PRESETS = ["💼", "🐔", "🥖", "🍰", "🛍️", "🚜", "🌾", "🐟", "✂️", "🧵", "💄", "🚐", "📱", "🍲"];

type Variant = "dark" | "light";

export function ActivitySwitcher({
  variant = "dark",
  discreet = false,
  iconOnly = false,
}: {
  variant?: Variant;
  discreet?: boolean;
  iconOnly?: boolean;
}) {
  const { activities, activeId, setActive, refetch } = useActiveActivity();
  const navigate = useNavigate();
  const createFn = useServerFn(createActivity);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("💼");
  const [busy, setBusy] = useState(false);

  const active = activities.find((a) => a.id === activeId) ?? activities[0];
  const visible = activities.filter((a) => !a.is_archived);

  const baseDark = discreet
    ? "bg-transparent hover:bg-white/10 text-white/70 border border-white/15"
    : "bg-white/15 hover:bg-white/25 text-white border border-white/20";
  const styles =
    variant === "dark"
      ? baseDark
      : "bg-brand-green/10 hover:bg-brand-green/15 text-brand-green border border-brand-green/15";

  const submitCreate = async () => {
    if (!newName.trim()) return toast.error("Nom requis");
    setBusy(true);
    try {
      await createFn({ data: { name: newName.trim(), emoji: newEmoji, setActive: true } });
      toast.success("Activité créée");
      setNewName("");
      setNewEmoji("💼");
      setCreating(false);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  if (activities.length === 0) return null;

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          {iconOnly ? (
            <button
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white shrink-0 inline-flex items-center justify-center"
              aria-label={`Activité : ${active?.name ?? ""}`}
              title={active?.name ?? "Activité"}
            >
              <span className="text-base leading-none">{active?.emoji ?? "💼"}</span>
            </button>
          ) : (
            <button
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition max-w-[55vw] ${styles}`}
              aria-label="Changer d'activité"
            >
              <span className="text-sm leading-none">{active?.emoji ?? "💼"}</span>
              <span className="truncate">{active?.name ?? "Activité"}</span>
              <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
            </button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-brand-green/60">
            Mes activités
          </DropdownMenuLabel>
          {visible.map((a) => (
            <ActivityRow
              key={a.id}
              activity={a}
              active={a.id === activeId}
              onPick={async () => {
                await setActive(a.id);
                setOpen(false);
              }}
            />
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setOpen(false);
              setCreating(true);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4 text-brand-terracotta" />
            <span className="text-sm">Nouvelle activité</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setOpen(false);
              navigate({ to: "/settings/activities" });
            }}
            className="gap-2"
          >
            <Pencil className="w-4 h-4 text-brand-green/60" />
            <span className="text-sm">Gérer mes activités</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nouvelle activité</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold text-brand-green/60 mb-1">Icône</p>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_PRESETS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setNewEmoji(e)}
                    className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center ${
                      newEmoji === e ? "bg-brand-green text-white" : "bg-brand-sand hover:bg-brand-green/10"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-brand-green/60 mb-1">Nom</p>
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex. Poulets de chair"
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitCreate();
                }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreating(false)} disabled={busy}>
              Annuler
            </Button>
            <Button onClick={submitCreate} disabled={busy} className="bg-brand-terracotta text-white">
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActivityRow({
  activity,
  active,
  onPick,
}: {
  activity: Activity;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onPick(); }} className="gap-2">
      <span className="text-base leading-none">{activity.emoji ?? "💼"}</span>
      <span className="flex-1 text-sm truncate">{activity.name}</span>
      {active && <Check className="w-4 h-4 text-brand-terracotta" />}
    </DropdownMenuItem>
  );
}

/** Variante coach : sélecteur d'activité d'un entrepreneur, contrôlé par le parent. */
export function CoachActivityPicker({
  activities,
  value,
  onChange,
}: {
  activities: Activity[];
  value: string | "ALL";
  onChange: (v: string | "ALL") => void;
}) {
  const visible = activities.filter((a) => !a.is_archived);
  const current =
    value === "ALL" ? null : visible.find((a) => a.id === value) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold bg-brand-green/10 hover:bg-brand-green/15 text-brand-green border border-brand-green/15">
          <span className="text-sm leading-none">{current?.emoji ?? "📊"}</span>
          <span className="truncate max-w-[180px]">
            {current?.name ?? "Toutes les activités"}
          </span>
          <ChevronDown className="w-3 h-3 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-brand-green/60">
          Activité analysée
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onChange("ALL"); }} className="gap-2">
          <span className="text-base leading-none">📊</span>
          <span className="flex-1 text-sm">Toutes les activités</span>
          {value === "ALL" && <Check className="w-4 h-4 text-brand-terracotta" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {visible.length === 0 ? (
          <p className="px-3 py-2 text-xs text-brand-green/60">Aucune activité.</p>
        ) : (
          visible.map((a) => (
            <DropdownMenuItem
              key={a.id}
              onSelect={(e) => { e.preventDefault(); onChange(a.id); }}
              className="gap-2"
            >
              <span className="text-base leading-none">{a.emoji ?? "💼"}</span>
              <span className="flex-1 text-sm truncate">{a.name}</span>
              {value === a.id && <Check className="w-4 h-4 text-brand-terracotta" />}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
