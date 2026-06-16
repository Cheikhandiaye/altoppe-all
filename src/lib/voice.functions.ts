import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SYSCOHADA_CATEGORIES } from "./syscohada";
import { getActiveActivityId } from "./activities.functions";
import { resolveInsertPosId } from "./pos.functions";

const Input = z.object({
  audio_base64: z.string().min(10),
  mime: z.string().default("audio/webm"),
  audio_hash: z.string().min(8).max(128), // sha-256 hex from client
  posId: z.string().uuid().optional(),
});


type ParsedItem = {
  type: "IN" | "OUT";
  amount: number;
  category?: string | null;
  label?: string | null;
  third_party?: string | null;
  is_personal?: boolean;
};

type ParsedPayload = {
  transcript: string;
  transactions: ParsedItem[];
};

const TOOL = {
  type: "function",
  function: {
    name: "save_transactions",
    description:
      "Enregistre UNE OU PLUSIEURS transactions comptables extraites d'un message vocal en wolof ou français. Toujours fournir le montant en FCFA (entier).",
    parameters: {
      type: "object",
      properties: {
        transcript: {
          type: "string",
          description: "Transcription textuelle exacte et complète du message vocal.",
        },
        transactions: {
          type: "array",
          description:
            "Liste de toutes les transactions distinctes mentionnées dans le message vocal. Une transaction = un mouvement d'argent (vente, achat, dépense, recette). Si l'utilisateur mentionne plusieurs opérations dans la même phrase, crée un élément par opération.",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["IN", "OUT"],
                description: "IN = recette/vente/encaissement, OUT = dépense/achat/sortie.",
              },
              amount: { type: "number", description: "Montant en FCFA (entier positif)." },
              category: {
                type: "string",
                description: "Code catégorie SYSCOHADA parmi la liste fournie, ou null si incertain.",
              },
              label: {
                type: "string",
                description: "Description courte de la transaction (ex: '3 sacs de riz', 'vente voiture').",
              },
              third_party: {
                type: "string",
                description: "Nom du client ou fournisseur si mentionné, sinon null.",
              },
              is_personal: { type: "boolean", description: "true si dépense personnelle/privée." },
            },
            required: ["type", "amount", "label"],
            additionalProperties: false,
          },
        },
      },
      required: ["transcript", "transactions"],
      additionalProperties: false,
    },
  },
} as const;

export const parseVoiceTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const baseExternalId = `voice:${data.audio_hash}`;
    const activeActivityId = await getActiveActivityId(supabase, userId);
    const { ownerId, posId: insertPosId } = await resolveInsertPosId(supabase, userId, data.posId);

    // Dedup : si des transactions VOICE existent déjà pour ce hash, les retourner
    const { data: existing } = await supabase
      .from("transactions")
      .select("id, type, amount, category, label, third_party, transcript, raw_extraction, validation_status, external_id")
      .eq("user_id", ownerId)
      .like("external_id", `${baseExternalId}%`);

    if (existing && existing.length > 0) {
      return {
        transactions: existing,
        transcript: existing[0]?.transcript ?? "",
        parsed: existing.map((e) => (e.raw_extraction as ParsedItem) ?? null).filter(Boolean) as ParsedItem[],
        duplicate: true as const,
      };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY non configuré");

    const catList = SYSCOHADA_CATEGORIES.map(
      (c) => `- ${c.code} (${c.type}, ${c.nature}) : ${c.label}${c.labelWo ? " / " + c.labelWo : ""}`,
    ).join("\n");

    const systemPrompt = `Tu es l'assistant comptable d'AL-TOPPE pour un commerçant sénégalais.
Tu reçois un message vocal en WOLOF ou en FRANÇAIS (souvent mélangés).
Transcris fidèlement, puis extrais TOUTES les transactions comptables mentionnées (une seule ou plusieurs) et appelle la fonction save_transactions.

IMPORTANT — DÉTECTION DE PLUSIEURS TRANSACTIONS :
- Un message peut contenir PLUSIEURS opérations (ex : "j'ai vendu X à 1M et ensuite acheté Y à 50 000"). Crée UN élément du tableau "transactions" PAR opération distincte.
- Mots-clés de séparation : "puis", "ensuite", "après", "et", "aussi", "ginnaaw loolu", "ak", "te", "nopp", "atte". Chaque verbe d'achat/vente différent = une transaction.
- Une vente ET un achat dans la même phrase = 2 transactions (une IN + une OUT).
- Plusieurs ventes ou plusieurs achats consécutifs = autant de transactions.

Vocabulaire wolof courant :
- "njaay" / "jaay" / "jayna" = vente (IN)
- "jënd" / "jënde" = achat (OUT)
- "pay" = salaire
- "lokeer" = loyer
- "yoon" = transport
- "ndox/léeram" = eau/électricité
- "boor" = emprunt
- "sama bopp" = personnel/privé
- "téeméer" = cent, "junni" = mille, "alfunni"/"million" = million
- Convertis toujours en chiffres FCFA. Exemples :
  - "deux mille cinq cents" → 2500
  - "1 million 400" / "un million quatre cent mille" → 1400000
  - "soixante quinze mille" / "75 000" → 75000

Catégories SYSCOHADA disponibles (utilise EXACTEMENT le code) :
${catList}

Si la catégorie n'est pas claire, mets category=null. Si dépense privée → is_personal=true.`;

    let aiResult: unknown = null;
    const logError = async (msg: string, transcript?: string) => {
      await supabase.from("ai_errors").insert({
        user_id: userId,
        source: "VOICE",
        external_id: baseExternalId,
        transcript: transcript ?? null,
        raw_response: aiResult ? JSON.parse(JSON.stringify(aiResult)) : null,
        error_message: msg,
      });
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: data.audio_base64,
                  format: data.mime.includes("webm")
                    ? "webm"
                    : data.mime.includes("mp4") || data.mime.includes("m4a")
                      ? "mp4"
                      : data.mime.includes("ogg")
                        ? "ogg"
                        : "webm",
                },
              },
              {
                type: "text",
                text: "Transcris ce message vocal puis appelle save_transactions avec TOUTES les transactions extraites (une ou plusieurs).",
              },
            ],
          },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "save_transactions" } },
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error("AI gateway error", response.status, txt);
      await logError(`Gateway ${response.status}: ${txt.slice(0, 300)}`);
      if (response.status === 429) throw new Error("Limite atteinte. Réessayez dans un instant.");
      if (response.status === 402) throw new Error("Crédits IA épuisés. Rechargez votre espace Lovable.");
      throw new Error(`Erreur IA (${response.status})`);
    }

    aiResult = await response.json();
    const call =
      (aiResult as { choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }> })
        ?.choices?.[0]?.message?.tool_calls?.[0];
    if (!call?.function?.arguments) {
      await logError("Aucun tool_call dans la réponse IA");
      throw new Error("Aucune transaction détectée dans le message vocal.");
    }

    let parsed: ParsedPayload;
    try {
      parsed = JSON.parse(call.function.arguments);
    } catch {
      await logError("JSON invalide dans tool_call.arguments");
      throw new Error("Réponse IA invalide");
    }

    const items = Array.isArray(parsed.transactions) ? parsed.transactions : [];
    const validItems = items.filter((i) => i && typeof i.amount === "number" && i.amount > 0);
    if (validItems.length === 0) {
      await logError(`Aucune transaction valide (transcript: ${parsed.transcript ?? "?"})`, parsed.transcript);
      throw new Error(`Aucune transaction détectée. Vous avez dit : « ${parsed.transcript ?? "?"} »`);
    }

    type Json = string | number | boolean | null | { [k: string]: Json | undefined } | Json[];
    const inserted: Array<{
      id: string;
      type: "IN" | "OUT";
      amount: number;
      label: string | null;
      category: string | null;
      third_party: string | null;
      transcript: string | null;
      validation_status: "A_VALIDER" | "VALIDE";
      external_id: string | null;
      raw_extraction: Json;
    }> = [];
    for (let idx = 0; idx < validItems.length; idx++) {
      const item = validItems[idx];
      const cat = item.category ? SYSCOHADA_CATEGORIES.find((c) => c.code === item.category) : null;
      const externalId = validItems.length === 1 ? baseExternalId : `${baseExternalId}:${idx}`;

      const { data: row, error } = await supabase
        .from("transactions")
        .insert({
          user_id: ownerId,
          type: item.type,
          amount: Math.round(item.amount),
          label: item.label ?? null,
          third_party: item.third_party ?? null,
          category: cat?.code ?? null,
          nature: cat?.nature ?? null,
          is_personal: !!item.is_personal || cat?.nature === "PERSONNEL",
          source: "VOICE",
          // Recorded voice transactions are committed directly to the entrepreneur's books
          // (no "à valider" badge). Coaches still see them via source = 'VOICE'.
          validation_status: "VALIDE",
          external_id: externalId,
          transcript: parsed.transcript ?? null,
          raw_extraction: JSON.parse(JSON.stringify(item)),
          activity_id: activeActivityId,
          pos_id: insertPosId,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          const { data: again } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", ownerId)
            .eq("external_id", externalId)
            .maybeSingle();

          if (again) {
            inserted.push(again);
            continue;
          }
        }
        await logError(`DB insert (idx ${idx}): ${error.message}`, parsed.transcript);
        throw new Error(error.message);
      }
      if (row) inserted.push(row);
    }

    return {
      transactions: inserted,
      transcript: parsed.transcript ?? "",
      parsed: validItems,
      duplicate: false as const,
    };
  });

export const listVoiceHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await (await import("./pos.functions")).getEffectiveOwnerId(supabase, userId);
    const [{ data: txns }, { data: errors }] = await Promise.all([
      supabase
        .from("transactions")
        .select(
          "id, type, amount, label, category, validation_status, occurred_at, transcript, raw_extraction, external_id",
        )
        .eq("user_id", ownerId)
        .eq("source", "VOICE")
        .order("occurred_at", { ascending: false })
        .limit(100),
      supabase
        .from("ai_errors")
        .select("id, transcript, error_message, raw_response, created_at, external_id")
        .eq("user_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    return { transactions: txns ?? [], errors: errors ?? [] };
  });

