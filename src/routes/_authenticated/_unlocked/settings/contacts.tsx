import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, X, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
} from "@/lib/contacts.functions";

export const Route = createFileRoute("/_authenticated/_unlocked/settings/contacts")({
  component: ContactsPage,
});

type ContactType = "CLIENT" | "FOURNISSEUR";

function ContactsPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listContacts);
  const create = useServerFn(createContact);
  const update = useServerFn(updateContact);
  const remove = useServerFn(deleteContact);

  const [tab, setTab] = useState<ContactType>("CLIENT");

  const q = useQuery({
    queryKey: ["contacts", tab],
    queryFn: () => fetchList({ data: { type: tab } }),
  });

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const [editId, setEditId] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [ePhone, setEPhone] = useState("");
  const [eEmail, setEEmail] = useState("");
  const [eNotes, setENotes] = useState("");

  const reset = () => {
    setName(""); setPhone(""); setEmail(""); setNotes(""); setAdding(false);
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Nom requis");
    try {
      await create({ data: { name: name.trim(), type: tab, phone: phone || null, email: email || null, notes: notes || null } });
      toast.success("Ajouté");
      reset();
      qc.invalidateQueries({ queryKey: ["contacts", tab] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const startEdit = (c: { id: string; name: string; phone: string | null; email: string | null; notes: string | null }) => {
    setEditId(c.id);
    setEName(c.name);
    setEPhone(c.phone ?? "");
    setEEmail(c.email ?? "");
    setENotes(c.notes ?? "");
  };

  const saveEdit = async () => {
    if (!editId || !eName.trim()) return;
    try {
      await update({ data: { id: editId, name: eName.trim(), phone: ePhone || null, email: eEmail || null, notes: eNotes || null } });
      toast.success("Modifié");
      setEditId(null);
      qc.invalidateQueries({ queryKey: ["contacts", tab] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const doDelete = async (id: string) => {
    if (!confirm("Supprimer ce contact ?")) return;
    try {
      await remove({ data: { id } });
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["contacts", tab] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const contacts = q.data?.contacts ?? [];

  return (
    <div className="space-y-4 pb-6">
      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-card rounded-2xl border border-brand-green/10">
        {(["CLIENT", "FOURNISSEUR"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setEditId(null); reset(); }}
            className={`py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
              tab === t ? "bg-brand-green text-white shadow-soft" : "text-brand-green/60"
            }`}
          >
            {t === "CLIENT" ? "Clients" : "Fournisseurs"}
          </button>
        ))}
      </div>

      {/* Add form */}
      {adding ? (
        <form onSubmit={submitAdd} className="bg-card rounded-2xl p-4 border border-brand-green/10 space-y-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom" autoFocus />
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone (optionnel)" />
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optionnel)" />
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optionnel)" />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 bg-brand-green text-white">Enregistrer</Button>
            <Button type="button" variant="outline" onClick={reset}>Annuler</Button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-terracotta text-white font-bold text-sm"
        >
          <Plus className="w-4 h-4" />
          Ajouter {tab === "CLIENT" ? "un client" : "un fournisseur"}
        </button>
      )}

      {/* List */}
      {q.isLoading ? (
        <p className="text-sm text-brand-green/60 text-center py-6">Chargement…</p>
      ) : contacts.length === 0 ? (
        <div className="bg-card rounded-2xl p-8 text-center border border-brand-green/10">
          <p className="text-sm text-brand-green/60">Aucun {tab === "CLIENT" ? "client" : "fournisseur"}.</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-brand-green/10 overflow-hidden">
          {contacts.map((c, i) => {
            const editing = editId === c.id;
            if (editing) {
              return (
                <div key={c.id} className={`p-3 bg-brand-sand/50 ${i > 0 ? "border-t border-brand-green/5" : ""} space-y-2`}>
                  <Input value={eName} onChange={(e) => setEName(e.target.value)} className="h-9 text-xs" />
                  <Input value={ePhone} onChange={(e) => setEPhone(e.target.value)} placeholder="Téléphone" className="h-9 text-xs" />
                  <Input value={eEmail} onChange={(e) => setEEmail(e.target.value)} placeholder="Email" className="h-9 text-xs" />
                  <Input value={eNotes} onChange={(e) => setENotes(e.target.value)} placeholder="Notes" className="h-9 text-xs" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} className="flex-1 bg-success text-white"><Check className="w-4 h-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setEditId(null)}><X className="w-4 h-4" /></Button>
                  </div>
                </div>
              );
            }
            return (
              <div key={c.id} className={`p-3 flex items-start gap-3 ${i > 0 ? "border-t border-brand-green/5" : ""}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-brand-green text-sm truncate">{c.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {c.phone && <span className="text-[11px] text-brand-green/60 inline-flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</span>}
                    {c.email && <span className="text-[11px] text-brand-green/60 inline-flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>}
                  </div>
                  {c.notes && <p className="text-[11px] text-brand-green/50 mt-1 truncate">{c.notes}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(c)} className="p-2 rounded-lg hover:bg-brand-green/10 text-brand-green/70">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => doDelete(c.id)} className="p-2 rounded-lg hover:bg-brand-terracotta/10 text-brand-terracotta">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
