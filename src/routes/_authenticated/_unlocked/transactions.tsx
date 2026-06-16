import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useQueryClient, useSuspenseQuery, queryOptions, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Trash2, ArrowDownCircle, ArrowUpCircle, User, Pencil, X, Plus, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DeleteConfirmModal } from "@/components/DeleteConfirmModal";
import { InvoiceModal, type InvoiceLine } from "@/components/InvoiceModal";
import { getMyProfile } from "@/lib/settings.functions";

import { getDashboard } from "@/lib/dashboard.functions";
import {
  createTransaction,
  deleteTransaction,
  validateTransaction,
  listAllTransactions,
  updateTransaction,
} from "@/lib/transactions.functions";
import { listContacts, createContact } from "@/lib/contacts.functions";
import { categoriesByType, findCategory } from "@/lib/syscohada";

const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => getDashboard(),
});

export const Route = createFileRoute("/_authenticated/_unlocked/transactions")({
  validateSearch: z.object({ new: z.string().optional() }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: TransactionsPage,
});

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " F";
}

function TransactionsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchDashboard = useServerFn(getDashboard);
  const create = useServerFn(createTransaction);
  const validate = useServerFn(validateTransaction);
  const remove = useServerFn(deleteTransaction);
  const listAll = useServerFn(listAllTransactions);
  const update = useServerFn(updateTransaction);
  const fetchContacts = useServerFn(listContacts);
  const addContact = useServerFn(createContact);

  const { data } = useSuspenseQuery({
    ...dashboardQuery,
    queryFn: () => fetchDashboard(),
  });

  const contactType = (t: "IN" | "OUT"): "CLIENT" | "FOURNISSEUR" => (t === "IN" ? "CLIENT" : "FOURNISSEUR");

  const [type, setType] = useState<"IN" | "OUT">("OUT");
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [thirdParty, setThirdParty] = useState("");
  const [category, setCategory] = useState<string>("");
  const [isPersonal, setIsPersonal] = useState(false);
  const [isCredit, setIsCredit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const search = Route.useSearch();
  useEffect(() => {
    if (search.new === "1") {
      setFormOpen(true);
      navigate({ to: "/transactions", search: {}, replace: true });
    }
  }, [search.new, navigate]);





  // History filters
  const [filter, setFilter] = useState<"ALL" | "IN" | "OUT" | "PERSO">("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPersonal, setEditPersonal] = useState(false);
  const [editType, setEditType] = useState<"IN" | "OUT">("OUT");

  const startEdit = (t: {
    id: string;
    type: string;
    amount: number | string;
    label: string | null;
    category: string | null;
    is_personal: boolean;
  }) => {
    setEditId(t.id);
    setEditType(t.type === "IN" ? "IN" : "OUT");
    setEditAmount(String(t.amount));
    setEditLabel(t.label ?? "");
    setEditCategory(t.category ?? "");
    setEditPersonal(!!t.is_personal);
  };

  const cancelEdit = () => setEditId(null);

  const saveEdit = async () => {
    if (!editId) return;
    const amt = Number(editAmount.replace(/\s/g, "").replace(",", "."));
    if (!amt || amt <= 0) {
      toast.error("Montant invalide");
      return;
    }
    try {
      await update({
        data: {
          id: editId,
          type: editType,
          amount: amt,
          label: editLabel || null,
          category: editCategory || null,
          is_personal: editPersonal,
        },
      });
      toast.success("Transaction modifiée");
      setEditId(null);
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["all-transactions"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const historyQuery = useQuery({
    queryKey: ["all-transactions", dateFrom, dateTo],
    queryFn: () =>
      listAll({
        data: {
          from: dateFrom ? new Date(dateFrom).toISOString() : null,
          to: dateTo ? new Date(dateTo + "T23:59:59").toISOString() : null,
        },
      }),
  });
  const allTxns = historyQuery.data?.transactions ?? [];
  const filteredTxns = allTxns.filter((t) => {
    if (filter === "IN") return t.type === "IN" && !t.is_personal;
    if (filter === "OUT") return t.type === "OUT" && !t.is_personal;
    if (filter === "PERSO") return t.is_personal;
    return true;
  });

  const contactsQuery = useQuery({
    queryKey: ["contacts", contactType(type)],
    queryFn: () => fetchContacts({ data: { type: contactType(type) } }),
  });

  const cats = categoriesByType(type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount.replace(/\s/g, "").replace(",", "."));
    if (!amt || amt <= 0) {
      toast.error("Montant invalide");
      return;
    }
    const cat = category ? findCategory(category) : null;
    setSubmitting(true);
    try {
      await create({
        data: {
          type,
          amount: amt,
          label: label || null,
          third_party: thirdParty || null,
          category: cat?.code ?? null,
          nature: cat?.nature ?? null,
          is_personal: isPersonal || cat?.nature === "PERSONNEL",
          is_credit: type === "IN" ? isCredit : false,
        },
      });
      // Auto-add contact to address book if new
      const tp = thirdParty.trim();
      if (tp && !(contactsQuery.data?.contacts ?? []).some((c) => c.name.toLowerCase() === tp.toLowerCase())) {
        try {
          await addContact({ data: { name: tp, type: contactType(type) } });
          qc.invalidateQueries({ queryKey: ["contacts"] });
        } catch { /* ignore duplicate */ }
      }
      toast.success(isCredit && type === "IN" ? "Vente différée enregistrée" : "Transaction enregistrée");
      setFormOpen(false);
      setAmount("");

      setLabel("");
      setThirdParty("");
      setCategory("");
      setIsPersonal(false);
      setIsCredit(false);
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["all-transactions"] });
      await qc.invalidateQueries({ queryKey: ["receivables"] });

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidate = async (id: string) => {
    try {
      await validate({ data: { id } });
      toast.success("Validé");
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["all-transactions"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const handleDeleteConfirmed = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null);
    try {
      await remove({ data: { id } });
      toast.success("Supprimée");
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["all-transactions"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  // ===== Mode sélection / facture =====
  const [invoiceMode, setInvoiceMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const fetchProfile = useServerFn(getMyProfile);
  const profileQ = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });
  const companyName =
    profileQ.data?.profile?.business_name ?? profileQ.data?.profile?.full_name ?? "Mon entreprise";
  const companyPhone = profileQ.data?.profile?.phone ?? null;
  const companyNinea = profileQ.data?.profile?.ninea ?? null;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const enterInvoiceMode = () => {
    setInvoiceMode(true);
    setSelectedIds(new Set());
  };
  const exitInvoiceMode = () => {
    setInvoiceMode(false);
    setSelectedIds(new Set());
  };

  const selectedLines: InvoiceLine[] = useMemo(() => {
    return allTxns
      .filter((t) => selectedIds.has(t.id))
      .map((t) => ({
        id: t.id,
        label: t.label ?? null,
        category: t.category ? findCategory(t.category)?.label ?? t.category : null,
        amount: t.amount,
        pos_code: (t as { pos_code?: string | null }).pos_code ?? null,
        occurred_at: t.occurred_at,
      }));
  }, [allTxns, selectedIds]);
  const selectedTotal = selectedLines.reduce((s, l) => s + Number(l.amount), 0);

  // En mode facture, on filtre uniquement les recettes (IN, non-perso)
  const displayedTxns = invoiceMode
    ? filteredTxns.filter((t) => t.type === "IN" && !t.is_personal)
    : filteredTxns;

  return (
    <div className="min-h-screen bg-brand-sand pb-24">
      <header className="bg-brand-green text-white px-5 pt-6 pb-8 rounded-b-[2rem]">
        <button
          onClick={() => navigate({ to: "/app" })}
          className="inline-flex items-center gap-2 text-xs text-white/70 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Tableau de bord
        </button>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-gold mb-2">
          Historique
        </p>
        <h1 className="font-display text-3xl font-bold">Transactions</h1>

        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button className="mt-4 w-full h-11 bg-brand-terracotta hover:bg-brand-terracotta/90 text-white font-bold">
              <Plus className="w-4 h-4 mr-2" /> Enregistrer une transaction
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nouvelle transaction</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={handleSubmit}
              className="space-y-4 pt-2"
            >

          {/* IN / OUT toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-brand-green/5 rounded-2xl">
            <button
              type="button"
              onClick={() => {
                setType("IN");
                setCategory("");
              }}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition ${
                type === "IN"
                  ? "bg-success text-white shadow-soft"
                  : "text-brand-green/60"
              }`}
            >
              <ArrowDownCircle className="w-4 h-4" /> Recette
            </button>
            <button
              type="button"
              onClick={() => {
                setType("OUT");
                setCategory("");
              }}
              className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition ${
                type === "OUT"
                  ? "bg-brand-terracotta text-white shadow-soft"
                  : "text-brand-green/60"
              }`}
            >
              <ArrowUpCircle className="w-4 h-4" /> Dépense
            </button>
          </div>

          <div>
            <Label htmlFor="amount" className="text-brand-green">
              Montant (FCFA)
            </Label>
            <Input
              id="amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="text-2xl font-display font-bold h-14 mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="cat" className="text-brand-green">
              Catégorie SYSCOHADA
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="cat" className="h-12 mt-1">
                <SelectValue placeholder="Choisir une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {cats.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                    {c.labelWo ? ` · ${c.labelWo}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="label" className="text-brand-green">
              Description
            </Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ex: 3 sacs de riz"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="tp" className="text-brand-green">
              {type === "IN" ? "Client" : "Fournisseur"}
            </Label>
            <Input
              id="tp"
              value={thirdParty}
              onChange={(e) => setThirdParty(e.target.value)}
              placeholder="Choisir ou saisir un nom"
              className="mt-1"
              list={`contacts-${type}`}
            />
            <datalist id={`contacts-${type}`}>
              {(contactsQuery.data?.contacts ?? []).map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
            <p className="text-[10px] text-brand-green/50 mt-1">
              Nouveau nom = ajouté automatiquement au carnet {type === "IN" ? "clients" : "fournisseurs"}.
            </p>
          </div>

          <div className="flex items-center justify-between bg-brand-sand rounded-xl p-3">
            <div>
              <p className="text-sm font-semibold text-brand-green">
                {type === "IN" ? "Recette personnelle" : "Dépense personnelle"}
              </p>
              <p className="text-xs text-brand-green/60">
                Hors comptabilité du commerce
              </p>
            </div>
            <Switch checked={isPersonal} onCheckedChange={setIsPersonal} />
          </div>

          {type === "IN" && (
            <div className="flex items-center justify-between bg-brand-sand rounded-xl p-3">
              <div>
                <p className="text-sm font-semibold text-brand-green">
                  Vente différée (à crédit)
                </p>
                <p className="text-xs text-brand-green/60">
                  Le client n'a pas encore payé. Ajouté aux créances.
                </p>
              </div>
              <Switch checked={isCredit} onCheckedChange={setIsCredit} />
            </div>
          )}


          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 bg-brand-terracotta hover:bg-brand-terracotta/90 text-white font-bold"
          >
            {submitting ? "..." : "Enregistrer"}
          </Button>
            </form>
          </DialogContent>
        </Dialog>
      </header>


      {/* Pending */}
      {data.pending.length > 0 && (
        <section className="px-5 mt-8">
          <h3 className="font-display text-lg font-bold text-brand-green mb-3">
            À valider ({data.pending.length})
          </h3>
          <div className="space-y-2">
            {data.pending.map((t) => {
              const cat = t.category ? findCategory(t.category) : null;
              return (
                <div
                  key={t.id}
                  className="bg-card rounded-2xl p-4 border border-brand-terracotta/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-brand-green truncate">
                        {t.label || cat?.label || "Sans libellé"}
                      </p>
                      <p className="text-[11px] text-brand-green/50 mt-0.5">
                        {t.source} • {new Date(t.occurred_at).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <p
                      className={`font-display font-bold text-sm ${
                        t.type === "IN" ? "text-success" : "text-brand-terracotta"
                      }`}
                    >
                      {t.type === "IN" ? "+" : "−"}
                      {formatXOF(Number(t.amount))}
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleValidate(t.id)}
                      className="flex-1 bg-success hover:bg-success/90 text-white"
                    >
                      <Check className="w-4 h-4 mr-1" /> Valider
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteId(t.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Barre actions Enregistrer / Facture */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex gap-2.5">
        {invoiceMode ? (
          <>
            <button
              onClick={exitInvoiceMode}
              className="flex-1 py-3 rounded-xl border border-[#C0392B] text-[#C0392B] font-semibold text-sm hover:bg-[#C0392B]/5 transition"
            >
              Annuler
            </button>
            <button
              onClick={() => setInvoiceOpen(true)}
              disabled={selectedIds.size === 0}
              className={`flex-[2] py-3 rounded-xl font-semibold text-sm transition ${
                selectedIds.size > 0
                  ? "bg-[#2D6A4F] text-white"
                  : "bg-[#C9A84C] text-[#1B4332] opacity-60 cursor-not-allowed"
              }`}
            >
              Partager{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setFormOpen(true)}
              className="flex-[2] py-3 rounded-xl bg-[#1B4332] text-white font-semibold text-sm hover:bg-[#143025] transition flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Enregistrer une transaction
            </button>
            <button
              onClick={enterInvoiceMode}
              className="flex-1 py-3 rounded-xl bg-[#C9A84C] text-[#1B4332] font-bold text-sm hover:opacity-90 transition flex items-center justify-center gap-1.5"
            >
              <FileText className="w-4 h-4" /> Facture
            </button>
          </>
        )}
      </div>

      {invoiceMode && (
        <p className="text-center text-[13px] py-2 px-4 font-semibold text-[#C9A84C] bg-white border-b border-gray-100">
          {selectedIds.size === 0
            ? "Sélectionnez des ventes pour la facture"
            : `${selectedIds.size} sélectionnée(s) · Total : ${formatXOF(selectedTotal)}`}
        </p>
      )}

      {/* History */}
      <section className="px-5 mt-6">
        <h3 className="font-display text-lg font-bold text-brand-green mb-3">
          Historique
        </h3>


        {/* Date filters */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <Label htmlFor="from" className="text-[10px] uppercase text-brand-green/60">Du</Label>
            <Input id="from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 mt-1" />
          </div>
          <div>
            <Label htmlFor="to" className="text-[10px] uppercase text-brand-green/60">Au</Label>
            <Input id="to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 mt-1" />
          </div>
        </div>

        {/* Type filters */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {([
            { key: "ALL", label: "Tout", icon: null, color: "bg-brand-green" },
            { key: "IN", label: "Entrées", icon: ArrowDownCircle, color: "bg-success" },
            { key: "OUT", label: "Sorties", icon: ArrowUpCircle, color: "bg-brand-terracotta" },
            { key: "PERSO", label: "Perso", icon: User, color: "bg-brand-gold" },
          ] as const).map((f) => {
            const active = filter === f.key;
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition ${
                  active ? `${f.color} text-white shadow-soft` : "bg-card border border-brand-green/10 text-brand-green/60"
                }`}
              >
                {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
                {f.label}
              </button>
            );
          })}
        </div>

        {historyQuery.isLoading ? (
          <p className="text-sm text-brand-green/60 text-center py-6">Chargement…</p>
        ) : displayedTxns.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center border border-brand-green/10">
            <p className="text-sm text-brand-green/60">
              {invoiceMode ? "Aucune vente disponible." : "Aucune transaction."}
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-brand-green/10 overflow-hidden">
            {displayedTxns.map((t, i) => {
              const cat = t.category ? findCategory(t.category) : null;
              const isEditing = editId === t.id;
              const isSelected = selectedIds.has(t.id);
              if (isEditing) {
                return (
                  <div
                    key={t.id}
                    className={`px-4 py-3 bg-brand-sand/50 ${i > 0 ? "border-t border-brand-green/5" : ""}`}
                  >
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <Select value={editType} onValueChange={(v) => setEditType(v as "IN" | "OUT")}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IN">Recette</SelectItem>
                          <SelectItem value="OUT">Dépense</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        inputMode="numeric"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        placeholder="Montant"
                        className="h-9 text-xs"
                      />
                    </div>
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Description"
                      className="h-9 text-xs mb-2"
                    />
                    <Select value={editCategory} onValueChange={setEditCategory}>
                      <SelectTrigger className="h-9 text-xs mb-2"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                      <SelectContent>
                        {categoriesByType(editType).map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center justify-between bg-card rounded-lg px-3 py-2 mb-2">
                      <span className="text-xs text-brand-green">Dépense personnelle</span>
                      <Switch checked={editPersonal} onCheckedChange={setEditPersonal} />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit} className="flex-1 bg-brand-green hover:bg-brand-green/90 text-white">
                        <Check className="w-4 h-4 mr-1" /> Enregistrer
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              }
              return (
                <div
                  key={t.id}
                  onClick={invoiceMode ? () => toggleSelected(t.id) : undefined}
                  className={`flex items-center justify-between px-4 py-3 ${
                    i > 0 ? "border-t border-brand-green/5" : ""
                  } ${invoiceMode ? "cursor-pointer" : ""} ${isSelected ? "bg-brand-gold/10" : ""}`}
                >
                  {invoiceMode && (
                    <div
                      className={`w-[22px] h-[22px] mr-3 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                        isSelected ? "bg-[#1B4332] border-[#1B4332]" : "border-gray-300"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-green truncate">
                      {t.label || cat?.label || "Sans libellé"}
                      {t.is_personal && (
                        <span className="ml-2 text-[9px] font-bold uppercase text-brand-gold">Perso</span>
                      )}
                    </p>
                    <p className="text-[11px] text-brand-green/50 mt-0.5">
                      {cat?.label ?? "Non catégorisé"} •{" "}
                      {new Date(t.occurred_at).toLocaleDateString("fr-FR")} • {t.source}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p
                      className={`font-display font-bold text-sm ${
                        t.type === "IN" ? "text-success" : "text-brand-terracotta"
                      }`}
                    >
                      {t.type === "IN" ? "+" : "−"}
                      {formatXOF(Number(t.amount))}
                    </p>
                    {!invoiceMode && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEdit({
                            id: t.id, type: t.type, amount: t.amount,
                            label: t.label, category: t.category, is_personal: t.is_personal,
                          })}
                          className="text-brand-green/40 hover:text-brand-green p-1"
                          aria-label="Modifier"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(t.id)}
                          className="text-brand-green/30 hover:text-brand-terracotta p-1"
                          aria-label="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Link
          to="/app"
          className="block text-center text-xs font-semibold text-brand-terracotta hover:underline mt-6"
        >
          ← Retour au tableau de bord
        </Link>
      </section>

      <DeleteConfirmModal
        isOpen={!!deleteId}
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setDeleteId(null)}
        itemType="Cette transaction"
      />
      <InvoiceModal
        isOpen={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        lines={selectedLines}
        companyName={companyName}
        companyPhone={companyPhone}
        companyNinea={companyNinea}
      />
    </div>
  );
}

