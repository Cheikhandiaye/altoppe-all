import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X, Archive, ArchiveRestore } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createActivity,
  updateActivity,
  deleteActivity,
  setActiveActivity,
} from "@/lib/activities.functions";
import { useActiveActivity } from "@/hooks/use-active-activity";

export const Route = createFileRoute("/_authenticated/_unlocked/settings/activities")({
  component: ActivitiesPage,
});

const EMOJIS = ["💼", "🐔", "🥖", "🍰", "🛍️", "🚜", "🌾", "🐟", "✂️", "🧵", "💄", "🚐", "📱", "🍲", "🥬", "☕"];

function ActivitiesPage() {
  const { activities, activeId, refetch } = useActiveActivity();
  const qc = useQueryClient();
  const create = useServerFn(createActivity);
  const update = useServerFn(updateActivity);
  const remove = useServerFn(deleteActivity);
  const setActive = useServerFn(setActiveActivity);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("💼");
  const [busy, setBusy] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eEmoji, setEEmoji] = useState("💼");

  const reload = async () => {
    await refetch();
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
    await qc.invalidateQueries({ queryKey: ["contacts"] });
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Nom requis");
    setBusy(true);
    try {
      await create({ data: { name: name.trim(), emoji, setActive: false } });
      toast.success("Activité créée");
      setName(""); setEmoji("💼"); setAdding(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally { setBusy(false); }
  };

  const startEdit = (a: typeof activities[number]) => {
    setEditId(a.id); setEName(a.name); setEEmoji(a.emoji ?? "💼");
  };
  const saveEdit = async () => {
    if (!editId || !eName.trim()) return;
    try {
      await update({ data: { id: editId, name: eName.trim(), emoji: eEmoji } });
      toast.success("Modifié");
      setEditId(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const doDelete = async (id: string) => {
    if (!confirm("Supprimer cette activité ? Les transactions et contacts qui lui sont rattachés ne seront pas supprimés mais ne seront plus filtrés.")) return;
    try {
      await remove({ data: { id } });
      toast.success("Supprimée");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const toggleArchive = async (a: typeof activities[number]) => {
    try {
      await update({ data: { id: a.id, is_archived: !a.is_archived } });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const pickActive = async (id: string) => {
    try {
      await setActive({ data: { id } });
      await reload();
      toast.success("Activité active changée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="bg-brand-green/5 border border-brand-green/15 rounded-2xl p-4">
        <p className="text-sm text-brand-green/80">
          Gérez vos différentes activités (ex. <strong>Poulets de chair</strong> + <strong>Pâtisserie</strong>).
          Toutes vos transactions, vos clients et vos statistiques sont filtrés selon l'activité active.
        </p>
      </div>

      {adding ? (
        <form onSubmit={submitAdd} className="bg-card rounded-2xl p-4 border border-brand-green/10 space-y-3">
          <div>
            <p className="text-[11px] font-semibold text-brand-green/60 mb-1">Icône</p>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => setEmoji(e)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center ${
                    emoji === e ? "bg-brand-green text-white" : "bg-brand-sand hover:bg-brand-green/10"
                  }`}>{e}</button>
              ))}
            </div>
          </div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'activité" autoFocus />
          <div className="flex gap-2">
            <Button type="submit" disabled={busy} className="flex-1 bg-brand-green text-white">Créer</Button>
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>Annuler</Button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-terracotta text-white font-bold text-sm">
          <Plus className="w-4 h-4" /> Nouvelle activité
        </button>
      )}

      <div className="bg-card rounded-2xl border border-brand-green/10 overflow-hidden">
        {activities.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-brand-green/60">Aucune activité.</p>
        ) : activities.map((a, i) => {
          const editing = editId === a.id;
          const isActive = a.id === activeId;
          if (editing) {
            return (
              <div key={a.id} className={`p-3 bg-brand-sand/50 ${i > 0 ? "border-t border-brand-green/5" : ""} space-y-2`}>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJIS.map((e) => (
                    <button key={e} type="button" onClick={() => setEEmoji(e)}
                      className={`w-8 h-8 rounded-lg text-base flex items-center justify-center ${
                        eEmoji === e ? "bg-brand-green text-white" : "bg-white hover:bg-brand-green/10"
                      }`}>{e}</button>
                  ))}
                </div>
                <Input value={eName} onChange={(e) => setEName(e.target.value)} className="h-9 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit} className="flex-1 bg-success text-white"><Check className="w-4 h-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setEditId(null)}><X className="w-4 h-4" /></Button>
                </div>
              </div>
            );
          }
          return (
            <div key={a.id} className={`p-3 flex items-center gap-3 ${i > 0 ? "border-t border-brand-green/5" : ""} ${a.is_archived ? "opacity-50" : ""}`}>
              <button onClick={() => !isActive && !a.is_archived && pickActive(a.id)}
                disabled={isActive || a.is_archived}
                className="text-2xl">{a.emoji ?? "💼"}</button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-brand-green text-sm truncate">{a.name}</p>
                  {isActive && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-brand-terracotta text-white px-1.5 py-0.5 rounded">
                      Active
                    </span>
                  )}
                  {a.is_archived && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-brand-green/15 text-brand-green/70 px-1.5 py-0.5 rounded">
                      Archivée
                    </span>
                  )}
                </div>
                {!isActive && !a.is_archived && (
                  <button onClick={() => pickActive(a.id)} className="text-[11px] text-brand-terracotta font-semibold mt-0.5">
                    Activer
                  </button>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => startEdit(a)} className="p-2 rounded-lg hover:bg-brand-green/10 text-brand-green/70" aria-label="Modifier">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => toggleArchive(a)} className="p-2 rounded-lg hover:bg-brand-green/10 text-brand-green/70" aria-label={a.is_archived ? "Désarchiver" : "Archiver"}>
                  {a.is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                </button>
                <button onClick={() => doDelete(a.id)} className="p-2 rounded-lg hover:bg-brand-terracotta/10 text-brand-terracotta" aria-label="Supprimer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
