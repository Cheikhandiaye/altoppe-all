import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SYSCOHADA_CATEGORIES } from "./syscohada";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  Table as DocxTable,
  TableRow as DocxRow,
  TableCell as DocxCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
} from "docx";

export const listAssignedEntrepreneurs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: assigns, error } = await supabase
      .from("coach_assignments")
      .select("entrepreneur_id, assigned_at")
      .eq("coach_id", userId);
    if (error) throw new Error(error.message);

    const ids = (assigns ?? []).map((a) => a.entrepreneur_id);
    if (ids.length === 0) return { entrepreneurs: [] };

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, business_name, region, sector, phone")
      .in("id", ids);

    const { data: txns } = await supabase
      .from("transactions")
      .select("user_id, type, amount, validation_status, is_personal")
      .in("user_id", ids)
      .eq("is_personal", false);

    const agg: Record<string, { income: number; expense: number; pending: number }> = {};
    for (const id of ids) agg[id] = { income: 0, expense: 0, pending: 0 };
    for (const t of txns ?? []) {
      const a = agg[t.user_id];
      if (!a) continue;
      const amt = Number(t.amount) || 0;
      if (t.type === "IN") a.income += amt;
      else a.expense += amt;
      if (t.validation_status === "A_VALIDER") a.pending += 1;
    }

    return {
      entrepreneurs: (profiles ?? []).map((p) => ({
        ...p,
        ...agg[p.id],
        gain: (agg[p.id]?.income ?? 0) - (agg[p.id]?.expense ?? 0),
      })),
    };
  });

const DetailInput = z.object({
  entrepreneurId: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  typeFilter: z.enum(["ALL", "IN", "OUT"]).default("ALL"),
  activityId: z.union([z.string().uuid(), z.literal("ALL")]).default("ALL"),
  posId: z.union([z.string().uuid(), z.literal("ALL")]).default("ALL"),
});

export const getEntrepreneurDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => DetailInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, business_name, region, sector, phone")
      .eq("id", data.entrepreneurId)
      .single();
    if (pErr) throw new Error(pErr.message);

    let q = supabase
      .from("transactions")
      .select(
        "id, type, amount, label, category, nature, source, validation_status, occurred_at, is_personal, third_party, transcript, raw_extraction, coach_note, activity_id, pos_id",
      )
      .eq("user_id", data.entrepreneurId)
      .order("occurred_at", { ascending: false })
      .limit(500);
    if (data.from) q = q.gte("occurred_at", data.from);
    if (data.to) q = q.lte("occurred_at", data.to);
    if (data.typeFilter !== "ALL") q = q.eq("type", data.typeFilter);
    if (data.activityId !== "ALL") q = q.eq("activity_id", data.activityId);
    if (data.posId !== "ALL") q = q.eq("pos_id", data.posId);

    const { data: txns, error } = await q;
    if (error) throw new Error(error.message);

    const list = txns ?? [];
    let income = 0;
    let expense = 0;
    for (const t of list) {
      if (t.is_personal) continue;
      const amt = Number(t.amount) || 0;
      if (t.type === "IN") income += amt;
      else expense += amt;
    }
    return {
      profile,
      transactions: list,
      totals: { income, expense, gain: income - expense },
    };
  });


export const coachUpdateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        transactionId: z.string().uuid(),
        category: z.string().min(1).max(80).nullable().optional(),
        coach_note: z.string().max(500).nullable().optional(),
        validate: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: {
      category?: string | null;
      nature?: string | null;
      coach_note?: string | null;
      validation_status?: "VALIDE";
    } = {};
    if (data.category !== undefined) {
      const cat = data.category
        ? SYSCOHADA_CATEGORIES.find((c) => c.code === data.category)
        : null;
      patch.category = cat?.code ?? data.category ?? null;
      patch.nature = cat?.nature ?? null;
    }
    if (data.coach_note !== undefined) patch.coach_note = data.coach_note;
    if (data.validate) patch.validation_status = "VALIDE";
    const { error } = await supabase
      .from("transactions")
      .update(patch)
      .eq("id", data.transactionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== EXPORT INCOME STATEMENT ==============

// Sanitize text for WinAnsi (Helvetica) — strip narrow nbsp, smart quotes, arrows, emojis…
const ansi = (s: string) =>
  (s ?? "")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2192\u21D2\u25B6\u279E\u2794\u27A4\u27A1]/g, "->")
    .replace(/[\u2022\u25CF]/g, "-")
    .replace(/[^\x00-\xFF]/g, "?");

const fmt = (n: number) =>
  ansi(new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n)) + " F";

// Palette for charts (RGB 0-1)
const PALETTE: [number, number, number][] = [
  [0.11, 0.26, 0.2],
  [0.78, 0.55, 0.2],
  [0.2, 0.5, 0.7],
  [0.7, 0.3, 0.3],
  [0.55, 0.4, 0.65],
  [0.4, 0.6, 0.3],
  [0.85, 0.5, 0.3],
  [0.3, 0.55, 0.55],
  [0.6, 0.35, 0.2],
  [0.45, 0.45, 0.45],
];





// Income statement layout — mirrors the Google Sheets template.
type SectionDef = { key: string; title: string; codes: string[]; kind: "IN" | "OUT" };

const SECTIONS: SectionDef[] = [
  {
    key: "PRODUITS",
    title: "I. PRODUITS (Recettes)",
    kind: "IN",
    codes: ["70_VENTES", "706_SERVICES", "77_AUTRES_RECETTES", "16_EMPRUNT", "10_APPORT"],
  },
  {
    key: "PERSONNEL",
    title: "II.1 Charges de Personnel",
    kind: "OUT",
    codes: ["64_SALAIRES", "108_PRELEVEMENT"],
  },
  {
    key: "FONCTIONNEMENT",
    title: "II.2 Charges de Fonctionnement",
    kind: "OUT",
    codes: [
      "601_ACHATS_MARCH",
      "602_MATIERES",
      "604_EMBALLAGES",
      "61_TRANSPORT",
      "622_LOYER",
      "605_EAU_ELEC",
      "628_TELEPHONE",
      "624_ENTRETIEN",
    ],
  },
  {
    key: "IMPOTS",
    title: "II.3 Impôts, Finances & Divers",
    kind: "OUT",
    codes: ["63_IMPOTS", "627_BANQUE", "65_AUTRES_CHARGES"],
  },
  {
    key: "INVEST",
    title: "III. Investissements / Hors exploitation",
    kind: "OUT",
    codes: ["21_INVEST", "16_REMBOURS"],
  },
];

type Txn = {
  type: "IN" | "OUT";
  amount: number;
  label: string | null;
  category: string | null;
  nature: string | null;
  occurred_at: string;
  is_personal: boolean;
  third_party: string | null;
};

type Row = { code: string; label: string; amount: number };
type Section = { key: string; title: string; kind: "IN" | "OUT"; rows: Row[]; total: number };

function buildStatement(txns: Txn[]) {
  const byCode: Record<string, number> = {};
  for (const t of txns) {
    const code = t.category ?? "NON_CATEGORISE";
    if (t.is_personal && code !== "108_PRELEVEMENT") continue;
    byCode[code] = (byCode[code] ?? 0) + (Number(t.amount) || 0);
  }

  const usedCodes = new Set<string>();
  const sections: Section[] = SECTIONS.map((s) => {
    const rows: Row[] = s.codes.map((code) => {
      usedCodes.add(code);
      const meta = SYSCOHADA_CATEGORIES.find((c) => c.code === code);
      return { code, label: meta?.label ?? code, amount: byCode[code] ?? 0 };
    });
    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    return { ...s, rows, total };
  });

  // Anything else (non-mapped codes) goes into Autres — split by IN/OUT.
  const otherIn: Row[] = [];
  const otherOut: Row[] = [];
  for (const t of txns) {
    if (t.is_personal && t.category !== "108_PRELEVEMENT") continue;
    const code = t.category ?? "NON_CATEGORISE";
    if (usedCodes.has(code)) continue;
    const meta = SYSCOHADA_CATEGORIES.find((c) => c.code === code);
    const label = meta?.label ?? code;
    const bucket = t.type === "IN" ? otherIn : otherOut;
    const existing = bucket.find((r) => r.code === code);
    if (existing) existing.amount += Number(t.amount) || 0;
    else bucket.push({ code, label, amount: Number(t.amount) || 0 });
  }
  if (otherIn.length) {
    const extra = otherIn.reduce((s, r) => s + r.amount, 0);
    sections[0].rows.push(...otherIn);
    sections[0].total += extra;
  }
  if (otherOut.length) {
    sections.push({
      key: "AUTRES",
      title: "IV. Autres charges (non classées)",
      kind: "OUT",
      rows: otherOut,
      total: otherOut.reduce((s, r) => s + r.amount, 0),
    });
  }

  const totalProduits = sections.filter((s) => s.kind === "IN").reduce((s, x) => s + x.total, 0);
  const totalCharges = sections.filter((s) => s.kind === "OUT").reduce((s, x) => s + x.total, 0);

  return { sections, totalProduits, totalCharges, gain: totalProduits - totalCharges };
}

const pct = (part: number, total: number) =>
  total > 0 ? `${((part / total) * 100).toFixed(1)}%` : "-";

type ChartSlice = { label: string; value: number };

function buildProduitsSlices(s: ReturnType<typeof buildStatement>): ChartSlice[] {
  const prod = s.sections.find((x) => x.kind === "IN");
  if (!prod) return [];
  return prod.rows.filter((r) => r.amount > 0).map((r) => ({ label: `${r.code} ${r.label}`, value: r.amount }));
}

function buildChargesSlicesBySection(s: ReturnType<typeof buildStatement>): ChartSlice[] {
  return s.sections.filter((x) => x.kind === "OUT" && x.total > 0).map((x) => ({ label: x.title, value: x.total }));
}

function buildChargesSlicesByCode(s: ReturnType<typeof buildStatement>): ChartSlice[] {
  const out: ChartSlice[] = [];
  for (const sec of s.sections) {
    if (sec.kind !== "OUT") continue;
    for (const r of sec.rows) if (r.amount > 0) out.push({ label: `${r.code} ${r.label}`, value: r.amount });
  }
  return out.sort((a, b) => b.value - a.value).slice(0, 10);
}

async function generateFinancialAnalysis(
  profile: { business_name: string | null; full_name: string | null; sector: string | null; region: string | null } | null,
  statement: ReturnType<typeof buildStatement>,
  periodLabel: string,
): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return "Analyse IA indisponible (clé manquante).";
  const breakdown = statement.sections
    .map(
      (s) =>
        `${s.title} (Total : ${fmt(s.total)})\n` +
        s.rows
          .filter((r) => r.amount > 0)
          .map((r) => `  - ${r.code} ${r.label} : ${fmt(r.amount)} (${pct(r.amount, s.total)})`)
          .join("\n"),
    )
    .join("\n\n");
  const sys = `Tu es un expert-comptable et conseiller financier pour PME/TPE sénégalaises (référentiel SYSCOHADA, devise FCFA, contexte Afrique de l'Ouest). Tu rédiges une analyse financière concise, opérationnelle et chiffrée, en français, structurée en 4 parties courtes :
1. Lecture des résultats (chiffres clés, marge, structure des charges)
2. Points forts
3. Points de vigilance (alertes, risques)
4. Recommandations concrètes (3 à 5 actions priorisées et activables tout de suite)
Style direct, sans jargon inutile. 350 à 450 mots.`;
  const user = `Entreprise : ${profile?.business_name || profile?.full_name || "—"}
Secteur : ${profile?.sector ?? "—"}
Région : ${profile?.region ?? "—"}
Période : ${periodLabel}

Compte de résultat (SYSCOHADA SMT) :
${breakdown}

Total Produits (A) : ${fmt(statement.totalProduits)}
Total Charges (B) : ${fmt(statement.totalCharges)}
Résultat net (A - B) : ${fmt(statement.gain)} (${statement.gain >= 0 ? "bénéfice" : "perte"})

Rédige l'analyse financière de cette activité.`;
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
      }),
    });
    if (!resp.ok) return `Analyse IA indisponible (HTTP ${resp.status}).`;
    const r = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return r.choices?.[0]?.message?.content?.trim() || "Analyse IA non disponible.";
  } catch {
    return "Analyse IA indisponible (erreur réseau).";
  }
}

const ExportInput = z.object({
  entrepreneurId: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  typeFilter: z.enum(["ALL", "IN", "OUT"]).default("ALL"),
  activityId: z.union([z.string().uuid(), z.literal("ALL")]).default("ALL"),
  posId: z.union([z.string().uuid(), z.literal("ALL")]).default("ALL"),
  format: z.enum(["pdf", "docx"]),
});


export const exportIncomeStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ExportInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, business_name, region, sector, phone")
      .eq("id", data.entrepreneurId)
      .single();

    let q = supabase
      .from("transactions")
      .select("type, amount, label, category, nature, occurred_at, is_personal, third_party")
      .eq("user_id", data.entrepreneurId)
      .order("occurred_at", { ascending: false })
      .limit(2000);
    if (data.from) q = q.gte("occurred_at", data.from);
    if (data.to) q = q.lte("occurred_at", data.to);
    if (data.typeFilter !== "ALL") q = q.eq("type", data.typeFilter);
    if (data.activityId !== "ALL") q = q.eq("activity_id", data.activityId);
    if (data.posId !== "ALL") q = q.eq("pos_id", data.posId);

    const { data: txns, error } = await q;
    if (error) throw new Error(error.message);

    const statement = buildStatement((txns ?? []) as Txn[]);
    const title = profile?.business_name || profile?.full_name || "Entrepreneur";
    const periodLabel = `${data.from ? new Date(data.from).toLocaleDateString("fr-FR") : "Début"} - ${
      data.to ? new Date(data.to).toLocaleDateString("fr-FR") : "Aujourd'hui"
    }`;
    const filterLabel =
      data.typeFilter === "IN"
        ? "Recettes uniquement"
        : data.typeFilter === "OUT"
          ? "Dépenses uniquement"
          : "Recettes & dépenses";

    if (data.format === "pdf") {
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
      let page = pdf.addPage([595, 842]);
      let y = 800;
      const left = 40;
      const right = 555;
      const colCode = left;
      const colLabel = left + 90;
      const colPct = left + 380;
      const colAmt = left + 440;

      const drawText = (
        text: string,
        x: number,
        yy: number,
        opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {},
      ) => {
        page.drawText(ansi(text), {
          x,
          y: yy,
          size: opts.size ?? 9,
          font: opts.bold ? bold : font,
          color: rgb(...(opts.color ?? [0.1, 0.2, 0.15])),
        });
      };
      const ensureSpace = (needed: number) => {
        if (y - needed < 60) {
          page = pdf.addPage([595, 842]);
          y = 800;
        }
      };

      // ---- Chart helpers ----
      const drawPie = (cx: number, cy: number, r: number, slices: ChartSlice[]) => {
        const total = slices.reduce((s, x) => s + x.value, 0);
        if (total <= 0) {
          page.drawCircle({ x: cx, y: cy, size: r, color: rgb(0.92, 0.92, 0.92) });
          return;
        }
        let theta = 0;
        slices.forEach((s, i) => {
          const frac = s.value / total;
          if (frac <= 0) return;
          const theta2 = theta + frac * 2 * Math.PI;
          const x1 = r * Math.sin(theta);
          const y1 = -r * Math.cos(theta);
          const x2 = r * Math.sin(theta2);
          const y2 = -r * Math.cos(theta2);
          const largeArc = frac > 0.5 ? 1 : 0;
          const path = `M 0 0 L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
          const [pr, pg, pb] = PALETTE[i % PALETTE.length];
          page.drawSvgPath(path, {
            x: cx,
            y: cy,
            color: rgb(pr, pg, pb),
            borderColor: rgb(1, 1, 1),
            borderWidth: 1,
          });
          theta = theta2;
        });
      };

      const drawLegendAndBars = (x: number, topY: number, slices: ChartSlice[], barMaxW: number) => {
        const total = slices.reduce((s, x) => s + x.value, 0) || 1;
        let yy = topY;
        const lineH = 14;
        slices.forEach((s, i) => {
          if (yy < 60) {
            page = pdf.addPage([595, 842]);
            y = 800;
            yy = 780;
          }
          const [pr, pg, pb] = PALETTE[i % PALETTE.length];
          page.drawRectangle({ x, y: yy, width: 9, height: 9, color: rgb(pr, pg, pb) });
          drawText(s.label.slice(0, 38), x + 14, yy + 1, { size: 8 });
          const frac = s.value / total;
          const barX = x + 220;
          page.drawRectangle({
            x: barX,
            y: yy,
            width: barMaxW,
            height: 9,
            borderColor: rgb(0.85, 0.85, 0.85),
            borderWidth: 0.3,
          });
          page.drawRectangle({
            x: barX,
            y: yy,
            width: Math.max(0.5, frac * barMaxW),
            height: 9,
            color: rgb(pr, pg, pb),
          });
          drawText(
            `${(frac * 100).toFixed(1)}%  ·  ${fmt(s.value)}`,
            barX + barMaxW + 6,
            yy + 1,
            { size: 8, color: [0.3, 0.3, 0.3] },
          );
          yy -= lineH;
        });
        return yy;
      };

      const drawChartBlock = (title: string, slices: ChartSlice[]) => {
        // Ensure we have room for the block (~ 230pt depending on slices)
        const neededHeight = 30 + Math.max(120, 20 + slices.length * 14);
        ensureSpace(neededHeight);
        drawText(title, left, y, { bold: true, size: 13, color: [0.11, 0.26, 0.2] });
        y -= 18;
        const pieCy = y - 60;
        drawPie(left + 60, pieCy, 55, slices);
        drawLegendAndBars(left + 145, y - 6, slices, 180);
        y = pieCy - 75;
      };


      drawText("COMPTE DE RÉSULTAT (SMT)", left, y, {
        size: 18,
        bold: true,
        color: [0.11, 0.26, 0.2],
      });
      y -= 22;
      drawText(title, left, y, { size: 13, bold: true });
      y -= 13;
      drawText(
        `${profile?.sector ?? "-"} · ${profile?.region ?? "-"} · ${profile?.phone ?? "-"}`,
        left,
        y,
        { size: 9, color: [0.4, 0.4, 0.4] },
      );
      y -= 12;
      drawText(`Période : ${periodLabel}`, left, y, { size: 9, color: [0.4, 0.4, 0.4] });
      y -= 11;
      drawText(`Filtre : ${filterLabel}`, left, y, { size: 9, color: [0.4, 0.4, 0.4] });
      y -= 22;

      drawText("Code", colCode, y, { bold: true, size: 9 });
      drawText("Libellé", colLabel, y, { bold: true, size: 9 });
      drawText("%", colPct, y, { bold: true, size: 9 });
      drawText("Montant (FCFA)", colAmt, y, { bold: true, size: 9 });
      y -= 5;
      page.drawLine({
        start: { x: left, y },
        end: { x: right, y },
        thickness: 0.7,
        color: rgb(0.11, 0.26, 0.2),
      });
      y -= 13;

      for (const section of statement.sections) {
        ensureSpace(40);
        page.drawRectangle({
          x: left - 2,
          y: y - 3,
          width: right - left + 4,
          height: 15,
          color: rgb(0.91, 0.94, 0.91),
        });
        drawText(section.title, colCode, y, { bold: true, size: 10, color: [0.11, 0.26, 0.2] });
        drawText(fmt(section.total), colAmt, y, {
          bold: true,
          size: 10,
          color: [0.11, 0.26, 0.2],
        });
        y -= 16;

        for (const r of section.rows) {
          ensureSpace(14);
          drawText(r.code, colCode, y, { size: 8, color: [0.4, 0.4, 0.4] });
          drawText(r.label.slice(0, 48), colLabel, y, { size: 9 });
          drawText(pct(r.amount, section.total), colPct, y, { size: 9 });
          drawText(r.amount ? fmt(r.amount) : "-", colAmt, y, { size: 9 });
          y -= 12;
        }
        y -= 4;
      }

      ensureSpace(80);
      y -= 6;
      page.drawLine({
        start: { x: left, y },
        end: { x: right, y },
        thickness: 1,
        color: rgb(0.11, 0.26, 0.2),
      });
      y -= 16;
      drawText("TOTAL DES PRODUITS (A)", colCode, y, { bold: true, size: 11 });
      drawText(fmt(statement.totalProduits), colAmt, y, {
        bold: true,
        size: 11,
        color: [0.1, 0.5, 0.2],
      });
      y -= 15;
      drawText("TOTAL DES CHARGES (B)", colCode, y, { bold: true, size: 11 });
      drawText(fmt(statement.totalCharges), colAmt, y, {
        bold: true,
        size: 11,
        color: [0.7, 0.2, 0.15],
      });
      y -= 20;
      const gainColor: [number, number, number] =
        statement.gain >= 0 ? [0.1, 0.5, 0.2] : [0.7, 0.2, 0.15];
      drawText(
        statement.gain >= 0
          ? "RÉSULTAT NET SMT (A - B) - BÉNÉFICE"
          : "RÉSULTAT NET SMT (A - B) - PERTE",
        colCode,
        y,
        { bold: true, size: 13, color: gainColor },
      );
      drawText(fmt(statement.gain), colAmt, y, { bold: true, size: 13, color: gainColor });

      // ============== GRAPHIQUES ==============
      const produitsSlices = buildProduitsSlices(statement);
      const chargesBySection = buildChargesSlicesBySection(statement);
      const chargesByCode = buildChargesSlicesByCode(statement);

      page = pdf.addPage([595, 842]);
      y = 800;
      drawText("ANALYSE GRAPHIQUE", left, y, { bold: true, size: 16, color: [0.11, 0.26, 0.2] });
      y -= 26;

      if (produitsSlices.length > 0) {
        drawChartBlock("Répartition des PRODUITS (Recettes)", produitsSlices);
      } else {
        drawText("Aucune recette sur la période.", left, y, { size: 10, color: [0.4, 0.4, 0.4] });
        y -= 20;
      }

      if (chargesBySection.length > 0) {
        drawChartBlock("Répartition des CHARGES par grand poste", chargesBySection);
      }
      if (chargesByCode.length > 0) {
        drawChartBlock("Top 10 des CHARGES par catégorie", chargesByCode);
      }

      // ============== ANALYSE FINANCIÈRE IA ==============
      const analysis = await generateFinancialAnalysis(profile, statement, periodLabel);
      page = pdf.addPage([595, 842]);
      y = 800;
      drawText("ANALYSE FINANCIÈRE (IA)", left, y, { bold: true, size: 16, color: [0.11, 0.26, 0.2] });
      y -= 22;
      drawText(
        `Activité : ${title} · ${profile?.sector ?? "-"} · ${profile?.region ?? "-"}`,
        left,
        y,
        { size: 9, color: [0.4, 0.4, 0.4] },
      );
      y -= 12;
      drawText(`Période : ${periodLabel}`, left, y, { size: 9, color: [0.4, 0.4, 0.4] });
      y -= 20;

      // Word-wrap helper
      const wrap = (text: string, size: number, maxWidth: number) => {
        const out: string[] = [];
        for (const para of text.split("\n")) {
          if (!para.trim()) {
            out.push("");
            continue;
          }
          const words = ansi(para).split(/\s+/);
          let line = "";
          for (const w of words) {
            const test = line ? line + " " + w : w;
            if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
            else {
              if (line) out.push(line);
              line = w;
            }
          }
          if (line) out.push(line);
        }
        return out;
      };

      const bodyLines = wrap(analysis, 10, right - left);
      for (const ln of bodyLines) {
        if (y < 70) {
          page = pdf.addPage([595, 842]);
          y = 800;
        }
        if (!ln) {
          y -= 6;
          continue;
        }
        // Bold headings if line starts with "1." "2." "3." "4."
        const isHeading = /^\s*([1-4]\.|#)/.test(ln);
        drawText(ln, left, y, { size: 10, bold: isHeading, color: isHeading ? [0.11, 0.26, 0.2] : [0.15, 0.15, 0.15] });
        y -= 13;
      }


      const bytes = await pdf.save();
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return {
        filename: `compte-resultat-${title.replace(/\s+/g, "-")}.pdf`,
        mime: "application/pdf",
        base64: btoa(binary),
      };
    }

    // ---------- DOCX ----------
    const border = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC" };
    const borders = { top: border, bottom: border, left: border, right: border };
    const W = { code: 1600, label: 4400, pct: 1200, amt: 2200 } as const;
    const TABLE_WIDTH = W.code + W.label + W.pct + W.amt;

    const cell = (
      text: string,
      w: number,
      opts: {
        bold?: boolean;
        shading?: string;
        color?: string;
        align?: (typeof AlignmentType)[keyof typeof AlignmentType];
      } = {},
    ) =>
      new DocxCell({
        borders,
        width: { size: w, type: WidthType.DXA },
        shading: opts.shading
          ? { fill: opts.shading, type: ShadingType.CLEAR, color: "auto" }
          : undefined,
        children: [
          new Paragraph({
            alignment: opts.align,
            children: [new TextRun({ text, bold: opts.bold, color: opts.color })],
          }),
        ],
      });

    const headerRow = new DocxRow({
      children: [
        cell("Code", W.code, { bold: true, shading: "1B4332", color: "FFFFFF" }),
        cell("Libellé", W.label, { bold: true, shading: "1B4332", color: "FFFFFF" }),
        cell("%", W.pct, {
          bold: true,
          shading: "1B4332",
          color: "FFFFFF",
          align: AlignmentType.RIGHT,
        }),
        cell("Montant (FCFA)", W.amt, {
          bold: true,
          shading: "1B4332",
          color: "FFFFFF",
          align: AlignmentType.RIGHT,
        }),
      ],
    });

    const dataRows: DocxRow[] = [];
    for (const section of statement.sections) {
      dataRows.push(
        new DocxRow({
          children: [
            cell(section.title, W.code + W.label + W.pct, { bold: true, shading: "E7EFEA" }),
            cell(fmt(section.total), W.amt, {
              bold: true,
              shading: "E7EFEA",
              align: AlignmentType.RIGHT,
            }),
          ],
        }),
      );
      for (const r of section.rows) {
        dataRows.push(
          new DocxRow({
            children: [
              cell(r.code, W.code),
              cell(r.label, W.label),
              cell(pct(r.amount, section.total), W.pct, { align: AlignmentType.RIGHT }),
              cell(r.amount ? fmt(r.amount) : "—", W.amt, { align: AlignmentType.RIGHT }),
            ],
          }),
        );
      }
    }

    dataRows.push(
      new DocxRow({
        children: [
          cell("TOTAL DES PRODUITS (A)", W.code + W.label + W.pct, {
            bold: true,
            shading: "F4F1DE",
          }),
          cell(fmt(statement.totalProduits), W.amt, {
            bold: true,
            shading: "F4F1DE",
            color: "1B4332",
            align: AlignmentType.RIGHT,
          }),
        ],
      }),
      new DocxRow({
        children: [
          cell("TOTAL DES CHARGES (B)", W.code + W.label + W.pct, {
            bold: true,
            shading: "F4F1DE",
          }),
          cell(fmt(statement.totalCharges), W.amt, {
            bold: true,
            shading: "F4F1DE",
            color: "B23A2E",
            align: AlignmentType.RIGHT,
          }),
        ],
      }),
      new DocxRow({
        children: [
          cell(
            statement.gain >= 0
              ? "RÉSULTAT NET SMT (A - B) — BÉNÉFICE"
              : "RÉSULTAT NET SMT (A - B) — PERTE",
            W.code + W.label + W.pct,
            { bold: true, shading: statement.gain >= 0 ? "D4E9DA" : "F5D5D0" },
          ),
          cell(fmt(statement.gain), W.amt, {
            bold: true,
            shading: statement.gain >= 0 ? "D4E9DA" : "F5D5D0",
            color: statement.gain >= 0 ? "1B4332" : "B23A2E",
            align: AlignmentType.RIGHT,
          }),
        ],
      }),
    );

    // ---- Build chart tables (bar charts) ----
    const PALETTE_HEX = [
      "1B4332", "C68C26", "3380B3", "B34D4D", "8C66A6",
      "669A4D", "D9803D", "4D8C8C", "996633", "737373",
    ];
    const buildBarTable = (slices: ChartSlice[]) => {
      const total = slices.reduce((s, x) => s + x.value, 0) || 1;
      const COL = { sw: 400, lbl: 3600, bar: 3600, pctc: 800, amt: 1000 };
      const rows: DocxRow[] = [
        new DocxRow({
          children: [
            cell("", COL.sw, { shading: "1B4332" }),
            cell("Libellé", COL.lbl, { bold: true, shading: "1B4332", color: "FFFFFF" }),
            cell("Répartition", COL.bar, { bold: true, shading: "1B4332", color: "FFFFFF" }),
            cell("%", COL.pctc, { bold: true, shading: "1B4332", color: "FFFFFF", align: AlignmentType.RIGHT }),
            cell("Montant", COL.amt, { bold: true, shading: "1B4332", color: "FFFFFF", align: AlignmentType.RIGHT }),
          ],
        }),
      ];
      slices.forEach((s, i) => {
        const frac = s.value / total;
        const blocks = Math.max(1, Math.round(frac * 28));
        const color = PALETTE_HEX[i % PALETTE_HEX.length];
        rows.push(
          new DocxRow({
            children: [
              cell("", COL.sw, { shading: color }),
              cell(s.label, COL.lbl),
              new DocxCell({
                borders,
                width: { size: COL.bar, type: WidthType.DXA },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: "\u2588".repeat(blocks), color, size: 18 })],
                  }),
                ],
              }),
              cell(`${(frac * 100).toFixed(1)}%`, COL.pctc, { align: AlignmentType.RIGHT }),
              cell(fmt(s.value), COL.amt, { align: AlignmentType.RIGHT }),
            ],
          }),
        );
      });
      return new DocxTable({
        width: { size: COL.sw + COL.lbl + COL.bar + COL.pctc + COL.amt, type: WidthType.DXA },
        columnWidths: [COL.sw, COL.lbl, COL.bar, COL.pctc, COL.amt],
        rows,
      });
    };

    const produitsSlicesDoc = buildProduitsSlices(statement);
    const chargesBySectionDoc = buildChargesSlicesBySection(statement);
    const chargesByCodeDoc = buildChargesSlicesByCode(statement);

    // ---- AI analysis ----
    const analysisDoc = await generateFinancialAnalysis(profile, statement, periodLabel);

    const chartChildren: (Paragraph | DocxTable)[] = [];
    const addChart = (title: string, slices: ChartSlice[], emptyMsg: string) => {
      chartChildren.push(
        new Paragraph({
          spacing: { before: 240, after: 120 },
          children: [new TextRun({ text: title, bold: true, size: 24, color: "1B4332" })],
        }),
      );
      if (slices.length === 0) {
        chartChildren.push(
          new Paragraph({ children: [new TextRun({ text: emptyMsg, italics: true, color: "888888" })] }),
        );
      } else {
        chartChildren.push(buildBarTable(slices));
      }
    };
    addChart("Répartition des PRODUITS (Recettes)", produitsSlicesDoc, "Aucune recette sur la période.");
    addChart("Répartition des CHARGES par grand poste", chargesBySectionDoc, "Aucune charge sur la période.");
    addChart("Top 10 des CHARGES par catégorie", chargesByCodeDoc, "—");

    // Analysis paragraphs (split by blank lines)
    const analysisParagraphs: Paragraph[] = [
      new Paragraph({
        spacing: { before: 360, after: 180 },
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "Analyse financière (IA)", bold: true, color: "1B4332" })],
      }),
    ];
    for (const block of analysisDoc.split(/\n\n+/)) {
      analysisParagraphs.push(
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: block.trim(), size: 22 })],
        }),
      );
    }

    const doc = new DocxDocument({
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
            },
          },
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: "COMPTE DE RÉSULTAT (SMT)", bold: true })],
            }),
            new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 28 })] }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `${profile?.sector ?? "—"} · ${profile?.region ?? "—"} · ${profile?.phone ?? "—"}`,
                  size: 18,
                  color: "666666",
                }),
              ],
            }),
            new Paragraph({
              children: [new TextRun({ text: `Période : ${periodLabel}`, size: 18 })],
            }),
            new Paragraph({
              children: [new TextRun({ text: `Filtre : ${filterLabel}`, size: 18 })],
            }),
            new Paragraph({ children: [new TextRun({ text: " " })] }),
            new DocxTable({
              width: { size: TABLE_WIDTH, type: WidthType.DXA },
              columnWidths: [W.code, W.label, W.pct, W.amt],
              rows: [headerRow, ...dataRows],
            }),
            new Paragraph({
              spacing: { before: 360, after: 120 },
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: "Analyse graphique", bold: true, color: "1B4332" })],
            }),
            ...chartChildren,
            ...analysisParagraphs,
            new Paragraph({ children: [new TextRun({ text: " " })] }),
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: "Système Minimal de Trésorerie (SYSCOHADA) — généré par AL-TOPPE",
                  size: 16,
                  color: "888888",
                  italics: true,
                }),
              ],
            }),
          ],
        },
      ],
    });


    const buf = await Packer.toBuffer(doc);
    const u8 = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return {
      filename: `compte-resultat-${title.replace(/\s+/g, "-")}.docx`,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      base64: btoa(bin),
    };
  });

// ============== BUSINESS MODEL CANVAS ==============

const BMC_FIELDS = [
  "key_partners",
  "key_activities",
  "key_resources",
  "value_propositions",
  "customer_relationships",
  "channels",
  "customer_segments",
  "cost_structure",
  "revenue_streams",
] as const;

type BMCField = (typeof BMC_FIELDS)[number];
type BMCContent = Record<BMCField, string> & { activity_description: string };

export const getBMC = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ entrepreneurId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: bmc, error } = await supabase
      .from("business_model_canvas")
      .select("*")
      .eq("user_id", data.entrepreneurId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { bmc };
  });

const BMCSaveInput = z.object({
  entrepreneurId: z.string().uuid(),
  activity_description: z.string().max(3000).optional(),
  key_partners: z.string().max(3000).optional(),
  key_activities: z.string().max(3000).optional(),
  key_resources: z.string().max(3000).optional(),
  value_propositions: z.string().max(3000).optional(),
  customer_relationships: z.string().max(3000).optional(),
  channels: z.string().max(3000).optional(),
  customer_segments: z.string().max(3000).optional(),
  cost_structure: z.string().max(3000).optional(),
  revenue_streams: z.string().max(3000).optional(),
});

export const saveBMC = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => BMCSaveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { entrepreneurId, ...fields } = data;
    const { data: existing } = await supabase
      .from("business_model_canvas")
      .select("id")
      .eq("user_id", entrepreneurId)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("business_model_canvas")
        .update(fields)
        .eq("user_id", entrepreneurId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("business_model_canvas").insert({
        user_id: entrepreneurId,
        created_by: userId,
        ...fields,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const generateBMC = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        entrepreneurId: z.string().uuid(),
        activity_description: z.string().min(20).max(3000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY non configuré");

    const { data: profile } = await supabase
      .from("profiles")
      .select("business_name, full_name, sector, region")
      .eq("id", data.entrepreneurId)
      .single();

    const TOOL = {
      type: "function" as const,
      function: {
        name: "save_bmc",
        description: "Enregistre le Business Model Canvas (9 blocs) en français.",
        parameters: {
          type: "object",
          properties: Object.fromEntries(
            BMC_FIELDS.map((f) => [
              f,
              {
                type: "string",
                description: `Contenu du bloc ${f.replace(/_/g, " ")} (3 à 6 puces concrètes, séparées par des sauts de ligne, commençant par "• ").`,
              },
            ]),
          ),
          required: [...BMC_FIELDS],
        },
      },
    };

    const systemPrompt = `Tu es un consultant en stratégie qui rédige un Business Model Canvas (BMC) en français pour un entrepreneur sénégalais (contexte Afrique de l'Ouest, FCFA, marché informel et formel).
Tu remplis OBLIGATOIREMENT les 9 blocs du BMC avec des éléments CONCRETS, SPÉCIFIQUES à l'activité décrite (pas générique).
Chaque bloc = 3 à 6 puces courtes commençant par "• ", séparées par des sauts de ligne.
Style : direct, opérationnel, adapté à une PME / TPE africaine.`;

    const userPrompt = `Entrepreneur : ${profile?.business_name || profile?.full_name || "—"}
Secteur : ${profile?.sector ?? "—"}
Région : ${profile?.region ?? "—"}

Description détaillée de l'activité :
"""
${data.activity_description}
"""

Rédige un BMC complet et appelle save_bmc.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "save_bmc" } },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      if (resp.status === 429) throw new Error("Limite atteinte. Réessayez dans un instant.");
      if (resp.status === 402) throw new Error("Crédits IA épuisés. Rechargez votre espace Lovable.");
      throw new Error(`Erreur IA (${resp.status}): ${txt.slice(0, 200)}`);
    }
    const result = (await resp.json()) as {
      choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
    };
    const args = result.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("L'IA n'a pas renvoyé de BMC.");
    const parsed = JSON.parse(args) as Partial<BMCContent>;

    const toSave: Partial<BMCContent> = { activity_description: data.activity_description };
    for (const f of BMC_FIELDS) toSave[f] = (parsed[f] ?? "").toString();

    const { data: existing } = await supabase
      .from("business_model_canvas")
      .select("id")
      .eq("user_id", data.entrepreneurId)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("business_model_canvas")
        .update(toSave)
        .eq("user_id", data.entrepreneurId);
    } else {
      await supabase.from("business_model_canvas").insert({
        user_id: data.entrepreneurId,
        created_by: userId,
        ...toSave,
      });
    }
    return { ok: true, bmc: toSave };
  });

// ============== EXPORT TRANSACTIONS (CSV/Excel) ==============

const ExportTxnInput = z.object({
  entrepreneurId: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  typeFilter: z.enum(["ALL", "IN", "OUT"]).default("ALL"),
  activityId: z.union([z.string().uuid(), z.literal("ALL")]).default("ALL"),
  posId: z.union([z.string().uuid(), z.literal("ALL")]).default("ALL"),
});

export const exportTransactionsXlsx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ExportTxnInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, business_name")
      .eq("id", data.entrepreneurId)
      .single();

    let q = supabase
      .from("transactions")
      .select("type, amount, label, category, nature, occurred_at, third_party, source, is_personal, validation_status, pos_id")
      .eq("user_id", data.entrepreneurId)
      .order("occurred_at", { ascending: false })
      .limit(5000);
    if (data.from) q = q.gte("occurred_at", data.from);
    if (data.to) q = q.lte("occurred_at", data.to);
    if (data.typeFilter !== "ALL") q = q.eq("type", data.typeFilter);
    if (data.activityId !== "ALL") q = q.eq("activity_id", data.activityId);
    if (data.posId !== "ALL") q = q.eq("pos_id", data.posId);
    const { data: txns, error } = await q;
    if (error) throw new Error(error.message);

    // Fetch POS codes for translation
    const { data: posRows } = await supabase
      .from("points_of_sale")
      .select("id, code")
      .eq("owner_user_id", data.entrepreneurId);
    const posCodeById = new Map<string, string>((posRows ?? []).map((p) => [p.id as string, p.code as string]));

    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      if (/[";\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const headers = [
      "Date",
      "Type",
      "Code PV",
      "Montant (FCFA)",
      "Libellé",
      "Catégorie",
      "Nature",
      "Tiers",
      "Source",
      "Statut",
      "Privé",
    ];
    const lines: string[] = [headers.join(";")];
    for (const t of txns ?? []) {
      lines.push(
        [
          new Date(t.occurred_at as string).toLocaleDateString("fr-FR"),
          t.type === "IN" ? "Recette" : "Dépense",
          t.pos_id ? (posCodeById.get(t.pos_id as string) ?? "") : "",
          Number(t.amount) || 0,
          t.label ?? "",
          t.category ?? "",
          t.nature ?? "",
          t.third_party ?? "",
          t.source ?? "",
          t.validation_status ?? "",
          t.is_personal ? "Oui" : "Non",
        ]
          .map(escape)
          .join(";"),
      );
    }
    const csv = "\uFEFF" + lines.join("\r\n");
    const bytes = new TextEncoder().encode(csv);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const title = profile?.business_name || profile?.full_name || "entrepreneur";
    return {
      filename: `transactions-${title.replace(/\s+/g, "-")}.csv`,
      mime: "text/csv;charset=utf-8",
      base64: btoa(binary),
    };
  });

