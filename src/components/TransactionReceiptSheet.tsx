import { useEffect } from "react";
import { Printer, Share2 } from "lucide-react";
import { toast } from "sonner";

export type ReceiptTxn = {
  id: string;
  type: "IN" | "OUT";
  amount: number | string;
  label: string | null;
  third_party?: string | null;
  category?: string | null;
  occurred_at: string;
  is_credit?: boolean;
  source?: string | null;
  pos_name?: string | null;
  seller_name?: string | null;
};

type Props = {
  txn: ReceiptTxn | null;
  companyName?: string | null;
  onClose: () => void;
};

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + "F";
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TransactionReceiptSheet({ txn, companyName, onClose }: Props) {
  useEffect(() => {
    if (!txn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [txn, onClose]);

  if (!txn) return null;

  const amount = Number(txn.amount);
  const isVente = txn.type === "IN";
  const isPaid = !txn.is_credit;
  const client = txn.third_party || (isVente ? "Client divers" : "Fournisseur divers");
  const seller = txn.seller_name || "—";
  const pos = txn.pos_name || "—";
  const company = companyName || "Mon Entreprise";

  const buildText = () =>
    [
      `Reçu AL-TOPPE`,
      `Type : ${isVente ? "Vente" : "Dépense"}`,
      `${isVente ? "Client" : "Fournisseur"} : ${client}`,
      `Montant : ${formatXOF(amount)} FCFA`,
      `Vendeur : ${seller}`,
      `Point de vente : ${pos}`,
      `Statut : ${isPaid ? "Payé" : "En attente"}`,
      `Date : ${formatDate(txn.occurred_at)}`,
      `ID : ${txn.id}`,
    ].join("\n");

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=400,height=700");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Reçu AL-TOPPE</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;color:#1A1A1A}
      h1{font-size:18px;text-align:center;margin:0 0 16px;padding:10px;background:#1A1A1A;color:#fff;border-radius:8px}
      .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:14px}
      .label{color:#9E9E9E}.val{font-weight:600}
      .footer{text-align:center;margin-top:20px;font-size:11px;color:#bbb;font-style:italic}</style></head><body>
      <h1>${company}</h1>
      <p style="text-align:center;color:#666;font-size:13px;margin-bottom:20px">Reçu de Transaction</p>
      <div class="row"><span class="label">Type</span><span class="val">${isVente ? "Vente" : "Dépense"}</span></div>
      <div class="row"><span class="label">${isVente ? "Client" : "Fournisseur"}</span><span class="val">${client}</span></div>
      <div class="row"><span class="label">Montant</span><span class="val">${formatXOF(amount)}</span></div>
      <div class="row"><span class="label">Vendeur</span><span class="val">${seller}</span></div>
      <div class="row"><span class="label">Point de vente</span><span class="val">${pos}</span></div>
      <div class="row"><span class="label">Statut</span><span class="val" style="color:${isPaid ? "#27AE60" : "#E07055"}">${isPaid ? "✓ Payé" : "⏳ En attente"}</span></div>
      <div class="row"><span class="label">Date</span><span class="val">${formatDate(txn.occurred_at)}</span></div>
      <div class="row"><span class="label">ID</span><span class="val" style="font-size:10px">${txn.id}</span></div>
      <p class="footer">En partenariat avec Wave Digital Finance.</p>
      <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script>
      </body></html>`);
    w.document.close();
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(buildText())}`;
    window.open(url, "_blank");
  };

  const handleShare = async () => {
    const text = buildText();
    if (navigator.share) {
      try {
        await navigator.share({ title: "Reçu AL-TOPPE", text });
        return;
      } catch {
        /* user cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Reçu copié dans le presse-papier");
    } catch {
      toast.error("Impossible de partager");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center animate-in fade-in duration-150"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#F5F5F5] rounded-t-[20px] pb-8 max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
      >
        {/* tirette */}
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* en-tête */}
        <div className="px-6 flex justify-center mb-2">
          <div className="bg-[#1A1A1A] text-white font-bold text-base rounded-lg px-6 py-3">
            {company}
          </div>
        </div>
        <p className="text-center text-[#6B6B6B] text-[15px] mb-5">Reçu de Transaction</p>

        {/* Aperçu */}
        <p className="px-6 text-[13px] text-[#9E9E9E] mb-2">Aperçu</p>
        <div className="mx-4 bg-white rounded-xl px-4 py-1 shadow-sm">
          <ReceiptRow label="Type de transaction" value={isVente ? "Vente" : "Dépense"} />
          <ReceiptRow label={isVente ? "Client" : "Fournisseur"} value={client} bold />
          <ReceiptRow label="Montant" value={formatXOF(amount)} />
          <ReceiptRow label="Vendeur" value={seller} bold />
          <ReceiptRow label="Point de vente" value={pos} bold last />
        </div>

        {/* Détails */}
        <p className="px-6 text-[13px] text-[#9E9E9E] mb-2 mt-5">Détails</p>
        <div className="mx-4 bg-white rounded-xl px-4 py-1 shadow-sm">
          <div className="flex justify-between items-center py-2.5 border-b border-[#F0F0F0]">
            <span className="text-sm text-[#9E9E9E]">Statut</span>
            {isPaid ? (
              <span className="flex items-center gap-1.5 text-[15px] font-bold text-[#27AE60]">
                <span className="w-4 h-4 rounded bg-[#27AE60] text-white text-[10px] flex items-center justify-center">✓</span>
                Payé
              </span>
            ) : (
              <span className="text-[15px] font-bold text-[#E07055]">⏳ En attente</span>
            )}
          </div>
          <ReceiptRow
            label="Reste dû"
            value={isPaid ? "0F" : formatXOF(amount)}
            bold
          />
          <ReceiptRow label="Date et heure" value={formatDate(txn.occurred_at)} />
          <div className="flex justify-between items-start py-2.5">
            <span className="text-sm text-[#9E9E9E] shrink-0">ID de transaction</span>
            <span className="text-[12px] text-[#9E9E9E] text-right break-all max-w-[180px]">
              {txn.id}
            </span>
          </div>
        </div>

        <p className="text-center text-[12px] text-[#BDBDBD] italic mt-5 mb-2 px-6">
          En partenariat avec Wave Digital Finance.
        </p>

        {/* Actions */}
        <div className="px-4 mt-4 flex gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#1B4332] text-white py-3 rounded-full text-[13px] font-semibold hover:bg-[#143025] transition"
          >
            <Printer className="w-4 h-4" /> Imprimer
          </button>
          <button
            onClick={handleWhatsApp}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#25D366] text-white py-3 rounded-full text-[13px] font-semibold hover:bg-[#1eb557] transition"
          >
            📱 WhatsApp
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#1B4332] text-white py-3 rounded-full text-[13px] font-semibold hover:bg-[#143025] transition"
          >
            <Share2 className="w-4 h-4" /> Partager
          </button>
        </div>
      </div>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  bold,
  last,
}: {
  label: string;
  value: string;
  bold?: boolean;
  last?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-2.5 ${last ? "" : "border-b border-[#F0F0F0]"}`}>
      <span className={`text-sm ${bold ? "text-[#1A1A1A] font-bold text-[15px]" : "text-[#9E9E9E]"}`}>
        {label}
      </span>
      <span className={`${bold ? "text-[15px] text-[#1A1A1A] font-bold" : "text-sm text-[#9E9E9E]"} text-right ml-3`}>
        {value}
      </span>
    </div>
  );
}
