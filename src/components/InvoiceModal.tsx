import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";

export type InvoiceLine = {
  id: string;
  label: string | null;
  category: string | null;
  amount: number;
  pos_code?: string | null;
  occurred_at: string;
};

type Props = {
  isOpen?: boolean;
  onClose: () => void;
  lines: InvoiceLine[] | null;
  companyName: string | null;
  companyPhone?: string | null;
  companyNinea?: string | null;
};

const formatXOF = (n: number) =>
  new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " F";

function buildInvoiceNo() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `FAC-${ymd}-${rand}`;
}

export function InvoiceModal({
  isOpen,
  onClose,
  lines,
  companyName,
  companyPhone,
  companyNinea,
}: Props) {
  const safeLines = lines ?? [];
  const total = useMemo(
    () => safeLines.reduce((s, l) => s + Number(l.amount || 0), 0),
    [safeLines],
  );
  const invoiceNo = useMemo(() => buildInvoiceNo(), [isOpen]);
  const dateStr = new Date().toLocaleDateString("fr-FR");

  const handlePrint = () => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;

    const rowsHtml = safeLines
      .map(
        (l, index) => `
          <tr>
            <td style="text-align:center">${index + 1}</td>
            <td>${l.label || "—"}</td>
            <td style="text-align:center">1</td>
            <td style="text-align:right">${formatXOF(Number(l.amount))}</td>
            <td style="text-align:center">0%</td>
            <td style="text-align:right; font-weight:bold">${formatXOF(Number(l.amount))}</td>
          </tr>`,
      )
      .join("");

    w.document.write(`<!doctype html><html><head>
        <style>
          body { font-family: sans-serif; padding: 40px; color: #333; line-height: 1.4; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
          .box { border: 1px solid #ddd; padding: 10px; border-radius: 4px; }
          h3 { font-size: 12px; color: #888; border-bottom: 1px solid #eee; margin: 0 0 5px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f4f4f4; text-align: left; padding: 10px; border: 1px solid #ddd; font-size: 12px; }
          td { padding: 10px; border: 1px solid #ddd; font-size: 13px; }
          .totals { margin-left: auto; width: 300px; margin-top: 20px; }
          .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
          .footer-payment { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 12px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
        </style>
      </head><body>
        <div style="display:flex; justify-content:space-between; border-bottom: 2px solid #333; padding-bottom: 10px;">
          <div>
            <h1 style="margin:0; font-size:20px;">${companyName}</h1>
            <p style="margin:0; font-size:12px;">NINEA : ${companyNinea || "..."}</p>
            ${companyPhone ? `<p style="margin:0; font-size:12px;">Tél : ${companyPhone}</p>` : ""}
          </div>
          <div style="text-align:right;">
            <h2 style="margin:0; color:#1B4332;">FACTURE</h2>
            <p style="margin:0;">N° : ${invoiceNo}</p>
            <p style="margin:0;">Date : ${dateStr}</p>
            <p style="margin:0; color:red;">Statut : À payer</p>
          </div>
        </div>

        <div class="grid-2" style="margin-top:20px;">
          <div class="box">
            <h3>ÉMIS PAR</h3>
            <p style="font-size:13px; margin:5px 0;">${companyName}</p>
          </div>
          <div class="box">
            <h3>FACTURÉ À</h3>
            <p style="font-size:13px; margin:5px 0;">Client : [Nom du client]</p>
          </div>
        </div>

        <h3>DÉTAIL DE LA FACTURE</h3>
        <table>
          <thead>
            <tr><th>N°</th><th>Description</th><th>Qté</th><th>Prix unitaire</th><th>Remise</th><th>Total</th></tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        <div class="totals">
          <div class="total-row"><span>Sous-total</span> <span>${formatXOF(total)}</span></div>
          <div class="total-row"><span>Remise globale</span> <span>0 F</span></div>
          <div class="total-row"><span>TVA (0%)</span> <span>0 F</span></div>
          <div class="total-row" style="font-weight:bold; border-top:1px solid #000; margin-top:5px;"><span>TOTAL À PAYER</span> <span>${formatXOF(total)}</span></div>
        </div>

        <div class="footer-payment">
          <h3>MODALITÉS DE PAIEMENT</h3>
          <p>Mode : Espèces / Mobile Money | Opérateur : Wave/OM</p>
          <p><em>Cette facture est générée par AL-TOPPE et transmise au format PDF (partageable via WhatsApp, E-mail, etc.).</em></p>
        </div>

        <div class="signatures">
          <div>Signature du client<br><br><br>________________</div>
          <div>Signature et cachet<br><br><br>________________</div>
        </div>

        <script>window.onload=()=>{window.print()}</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Facture {invoiceNo}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <div className="text-muted-foreground">{companyName}</div>
          <div className="border rounded-lg divide-y">
            {safeLines.map((l, i) => (
              <div key={l.id} className="flex justify-between p-2">
                <span>
                  {i + 1}. {l.label || l.category || "—"}
                </span>
                <span className="font-medium">{formatXOF(Number(l.amount))}</span>
              </div>
            ))}
            {safeLines.length === 0 && (
              <div className="p-3 text-center text-muted-foreground">
                Aucune ligne sélectionnée
              </div>
            )}
          </div>
          <div className="flex justify-between pt-2 font-bold border-t">
            <span>TOTAL</span>
            <span>{formatXOF(total)}</span>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={handlePrint} disabled={safeLines.length === 0}>
            Imprimer / PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
