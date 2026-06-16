import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X, Archive, ArchiveRestore, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createPOS, updatePOS, deletePOS } from "@/lib/pos.functions";
import { usePOS } from "@/hooks/use-pos";

export const Route = createFileRoute("/_authenticated/_unlocked/settings/points-de-vente")({
  component: PointsDeVentePage,
});

function PointsDeVentePage() {
  const { pos, activePosId, setActivePos, isSeller, refetch } = usePOS();
  const qc = useQueryClient();
  const create = useServerFn(createPOS);
  const update = useServerFn(updatePOS);
  const remove = useServerFn(deletePOS);
  const navigate = useNavigate();

  useEffect(() => {
    if (isSeller) navigate({ to: "/settings" });
  }, [isSeller, navigate]);

  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [eCode, setECode] = useState("");
  const [eName, setEName] = useState("");

  const reload = async () => {
    await refetch();
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
    await qc.invalidateQueries({ queryKey: ["transactions-list"] });
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return toast.error("Code et nom requis");
    setBusy(true);
    try {
      await create({ data: { code: code.trim().toUpperCase(), name: name.trim() } });
      toast.success("Point de vente créé");
      setCode(""); setName(""); setAdding(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally { setBusy(false); }
  };

  const startEdit = (p: typeof pos[number]) => {
    setEditId(p.id); setECode(p.code); setEName(p.name);
  };
  const saveEdit = async () => {
    if (!editId || !eCode.trim() || !eName.trim()) return;
    try {
      await update({ data: { id: editId, code: eCode.trim().toUpperCase(), name: eName.trim() } });
      toast.success("Modifié");
      setEditId(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const doDelete = async (id: string) => {
    if (!confirm("Supprimer ce point de vente ? Les transactions déjà saisies y resteront rattachées.")) return;
    try {
      await remove({ data: { id } });
      toast.success("Supprimé");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const toggleArchive = async (p: typeof pos[number]) => {
    try {
      await update({ data: { id: p.id, is_archived: !p.is_archived } });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="bg-brand-green/5 border border-brand-green/15 rounded-2xl p-4">
        <p className="text-sm text-brand-green/80">
          Un <strong>point de vente (PV)</strong> représente un lieu de vente avec son propre code court (ex. <code className="font-mono text-brand-terracotta font-bold">P1</code>, <code className="font-mono text-brand-terracotta font-bold">BOUTIQUE</code>).
          Chaque transaction enregistrée par un vendeur est étiquetée avec le code de son PV — le coach peut ensuite filtrer par code PV.
        </p>
      </div>

      {adding ? (
        <form onSubmit={submitAdd} className="bg-card rounded-2xl p-4 border border-brand-green/10 space-y-3">
          <div>
            <p className="text-[11px] font-semibold text-brand-green/60 mb-1">Code PV (max 12 caractères, sans espace)</p>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex. P1" maxLength={12} autoFocus className="font-mono uppercase" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-brand-green/60 mb-1">Nom complet</p>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Boutique centre-ville" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy} className="flex-1 bg-brand-green text-white">Créer</Button>
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>Annuler</Button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-terracotta text-white font-bold text-sm">
          <Plus className="w-4 h-4" /> Nouveau point de vente
        </button>
      )}

      <div className="bg-card rounded-2xl border border-brand-green/10 overflow-hidden">
        {pos.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-brand-green/60">Aucun point de vente.</p>
        ) : pos.map((p, i) => {
          const editing = editId === p.id;
          const isActive = p.id === activePosId;
          if (editing) {
            return (
              <div key={p.id} className={`p-3 bg-brand-sand/50 ${i > 0 ? "border-t border-brand-green/5" : ""} space-y-2`}>
                <Input value={eCode} onChange={(e) => setECode(e.target.value.toUpperCase())}
                  placeholder="Code" maxLength={12} className="h-9 text-sm font-mono uppercase" />
                <Input value={eName} onChange={(e) => setEName(e.target.value)} placeholder="Nom" className="h-9 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit} className="flex-1 bg-success text-white"><Check className="w-4 h-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setEditId(null)}><X className="w-4 h-4" /></Button>
                </div>
              </div>
            );
          }
          return (
            <div key={p.id} className={`p-3 flex items-center gap-3 ${i > 0 ? "border-t border-brand-green/5" : ""} ${p.is_archived ? "opacity-50" : ""}`}>
              <div className="w-12 h-12 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center shrink-0">
                <Store className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-mono font-bold text-brand-terracotta text-sm">{p.code}</p>
                  <p className="font-semibold text-brand-green text-sm truncate">{p.name}</p>
                  {isActive && !p.is_archived && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-brand-terracotta text-white px-1.5 py-0.5 rounded">
                      PV actif
                    </span>
                  )}
                  {p.is_archived && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-brand-green/15 text-brand-green/70 px-1.5 py-0.5 rounded">
                      Archivé
                    </span>
                  )}
                </div>
                {!isActive && !p.is_archived && (
                  <button onClick={() => setActivePos(p.id)} className="text-[11px] text-brand-terracotta font-semibold mt-0.5">
                    Définir comme PV actif
                  </button>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => startEdit(p)} className="p-2 rounded-lg hover:bg-brand-green/10 text-brand-green/70" aria-label="Modifier">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => toggleArchive(p)} className="p-2 rounded-lg hover:bg-brand-green/10 text-brand-green/70" aria-label={p.is_archived ? "Désarchiver" : "Archiver"}>
                  {p.is_archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                </button>
                <button onClick={() => doDelete(p.id)} className="p-2 rounded-lg hover:bg-brand-terracotta/10 text-brand-terracotta" aria-label="Supprimer">
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
