import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, KeyRound, UserPlus, Store, Copy, Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { listMySellers, createSeller, resetSellerPassword, deleteSeller } from "@/lib/pos.functions";
import { usePOS } from "@/hooks/use-pos";

export const Route = createFileRoute("/_authenticated/_unlocked/settings/vendeurs")({
  component: VendeursPage,
});

const sellersQ = queryOptions({
  queryKey: ["my-sellers"],
  queryFn: () => listMySellers(),
  staleTime: 0,
});

type Credentials = { fullName: string; phone: string; login: string; password: string; posLabel: string };

function VendeursPage() {
  const { pos, isSeller } = usePOS();
  const navigate = useNavigate();
  useEffect(() => { if (isSeller) navigate({ to: "/settings" }); }, [isSeller, navigate]);

  const qc = useQueryClient();
  const fetchList = useServerFn(listMySellers);
  const createFn = useServerFn(createSeller);
  const resetFn = useServerFn(resetSellerPassword);
  const removeFn = useServerFn(deleteSeller);

  const { data, isLoading } = useQuery({
    ...sellersQ,
    queryFn: () => fetchList(),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const sellers = data?.sellers ?? [];
  const posById = new Map(pos.map((p) => [p.id, p]));

  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [posId, setPosId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const visiblePos = pos.filter((p) => !p.is_archived);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !posId || password.length < 8) {
      toast.error("Tous les champs sont requis (mot de passe min. 8 caractères)");
      return;
    }
    setBusy(true);
    try {
      const res = await createFn({ data: { full_name: fullName.trim(), phone: phone.trim(), password, pos_id: posId } });
      const pv = pos.find((p) => p.id === posId);
      setCredentials({
        fullName: fullName.trim(),
        phone: phone.trim(),
        login: res.login,
        password,
        posLabel: pv ? `${pv.code} · ${pv.name}` : "",
      });
      toast.success("Vendeur créé");
      setOpen(false);
      setFullName(""); setPhone(""); setPassword(""); setPosId("");
      await qc.invalidateQueries({ queryKey: ["my-sellers"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally { setBusy(false); }
  };

  const doReset = async (sellerId: string) => {
    const pwd = prompt("Nouveau mot de passe (min. 8 caractères) :");
    if (!pwd || pwd.length < 8) return;
    try {
      await resetFn({ data: { sellerId, password: pwd } });
      toast.success("Mot de passe réinitialisé");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur"); }
  };
  const doDelete = async (sellerId: string) => {
    if (!confirm("Supprimer définitivement ce compte vendeur ?")) return;
    try {
      await removeFn({ data: { sellerId } });
      toast.success("Vendeur supprimé");
      await qc.invalidateQueries({ queryKey: ["my-sellers"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erreur"); }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="bg-brand-green/5 border border-brand-green/15 rounded-2xl p-4">
        <p className="text-sm text-brand-green/80">
          Créez un compte par <strong>vendeur</strong>. Chaque vendeur se connecte avec son <strong>numéro de téléphone</strong> et le mot de passe que vous lui fournissez.
          Ses saisies sont automatiquement étiquetées avec le code PV de son point de vente.
        </p>
        {visiblePos.length === 0 && (
          <p className="text-xs text-brand-terracotta font-semibold mt-2">
            Créez d'abord au moins un point de vente.
          </p>
        )}
      </div>

      <button
        onClick={() => setOpen(true)}
        disabled={visiblePos.length === 0}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-terracotta text-white font-bold text-sm disabled:opacity-50"
      >
        <UserPlus className="w-4 h-4" /> Nouveau vendeur
      </button>

      <div className="bg-card rounded-2xl border border-brand-green/10 overflow-hidden">
        {isLoading ? (
          <p className="px-4 py-8 text-center text-sm text-brand-green/60">Chargement…</p>
        ) : sellers.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-brand-green/60">Aucun vendeur pour le moment.</p>
        ) : sellers.map((s, i) => {
          const p = s.pos_id ? posById.get(s.pos_id) : null;
          const sanitized = (s.phone ?? "").replace(/\D/g, "");
          const login = sanitized ? `pv-${sanitized}@altope.local` : null;
          return (
            <div key={s.id} className={`p-3 flex items-start gap-3 ${i > 0 ? "border-t border-brand-green/5" : ""}`}>
              <div className="w-10 h-10 rounded-xl bg-brand-terracotta/10 text-brand-terracotta flex items-center justify-center shrink-0 font-bold">
                {(s.full_name ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-brand-green text-sm truncate">{s.full_name}</p>
                <p className="text-[11px] text-brand-green/60 flex items-center gap-1 mt-0.5 flex-wrap">
                  {s.phone}
                  {p && (
                    <>
                      <span className="text-brand-green/30">·</span>
                      <Store className="w-3 h-3 text-brand-green/40" />
                      <span className="font-mono font-bold text-brand-terracotta">{p.code}</span>
                      <span className="truncate">{p.name}</span>
                    </>
                  )}
                </p>
                {login && (
                  <p className="text-[10px] text-brand-green/50 mt-0.5">
                    Identifiant : <span className="font-mono text-brand-green/80 select-all">{login}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-1 shrink-0">
                <button onClick={() => doReset(s.id)} className="p-2 rounded-lg hover:bg-brand-green/10 text-brand-green/70" aria-label="Réinitialiser le mot de passe">
                  <KeyRound className="w-4 h-4" />
                </button>
                <button onClick={() => doDelete(s.id)} className="p-2 rounded-lg hover:bg-brand-terracotta/10 text-brand-terracotta" aria-label="Supprimer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nouveau vendeur</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <p className="text-[11px] font-semibold text-brand-green/60 mb-1">Nom complet</p>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex. Awa Diop" autoFocus />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-brand-green/60 mb-1">Téléphone (sera son identifiant)</p>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+221 77 ..." type="tel" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-brand-green/60 mb-1">Mot de passe initial (min. 8)</p>
              <Input value={password} onChange={(e) => setPassword(e.target.value)} type="text" placeholder="à communiquer au vendeur" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-brand-green/60 mb-1">Point de vente</p>
              <Select value={posId} onValueChange={setPosId}>
                <SelectTrigger><SelectValue placeholder="Choisir un PV" /></SelectTrigger>
                <SelectContent>
                  {visiblePos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="font-mono font-bold text-brand-terracotta mr-2">{p.code}</span>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>Annuler</Button>
              <Button type="submit" disabled={busy} className="bg-brand-terracotta text-white"><Plus className="w-4 h-4 mr-1" /> Créer</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}

function CredentialsDialog({ credentials, onClose }: { credentials: Credentials | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  if (!credentials) return null;

  const message =
    `Bonjour ${credentials.fullName},\n\n` +
    `Vos identifiants AL-TOPPE pour le point de vente ${credentials.posLabel} :\n\n` +
    `📱 Téléphone : ${credentials.phone}\n` +
    `🔑 Mot de passe : ${credentials.password}\n\n` +
    `Connectez-vous sur l'application avec votre numéro de téléphone et ce mot de passe.`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie impossible");
    }
  };

  const shareWhatsApp = () => {
    const digits = credentials.phone.replace(/\D/g, "");
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  };

  return (
    <Dialog open={!!credentials} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Identifiants du vendeur</DialogTitle>
          <DialogDescription>
            Transmettez ces informations à votre vendeur. Elles ne seront plus affichées en clair.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 bg-brand-sand rounded-xl p-3 text-sm">
          <Row label="Nom" value={credentials.fullName} />
          <Row label="Téléphone" value={credentials.phone} mono />
          <Row label="Mot de passe" value={credentials.password} mono highlight />
          <Row label="Point de vente" value={credentials.posLabel} />
        </div>
        <p className="text-[11px] text-brand-green/60">
          Le vendeur se connecte sur <strong>l'écran de connexion</strong> avec son <strong>téléphone</strong> et ce <strong>mot de passe</strong>.
        </p>
        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button type="button" variant="outline" onClick={copy} className="gap-2">
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copié" : "Copier"}
          </Button>
          <Button type="button" onClick={shareWhatsApp} className="bg-brand-green text-white gap-2">
            <Share2 className="w-4 h-4" /> Partager via WhatsApp
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] uppercase tracking-wider text-brand-green/60 font-semibold">{label}</span>
      <span className={`${mono ? "font-mono" : ""} ${highlight ? "text-brand-terracotta font-bold" : "text-brand-green"} select-all truncate`}>
        {value}
      </span>
    </div>
  );
}
