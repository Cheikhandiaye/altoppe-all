import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActivityFilter, getActiveActivityId } from "./activities.functions";
import { resolveInsertPosId, resolvePosFilter, getEffectiveOwnerId } from "./pos.functions";

const CreateInput = z.object({
  type: z.enum(["IN", "OUT"]),
  amount: z.number().positive().max(1_000_000_000),
  label: z.string().max(255).optional().nullable(),
  category: z.string().max(64).optional().nullable(),
  nature: z.enum(["EXPLOITATION", "HORS_EXPLOITATION", "PERSONNEL"]).optional().nullable(),
  third_party: z.string().max(255).optional().nullable(),
  is_personal: z.boolean().default(false),
  is_credit: z.boolean().default(false),
  occurred_at: z.string().optional(),
  activityId: z.string().uuid().optional(),
  posId: z.string().uuid().optional(),
});

export const createTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const activityId = data.activityId ?? (await getActiveActivityId(supabase, userId));
    const { ownerId, posId } = await resolveInsertPosId(supabase, userId, data.posId);
    const isCredit = data.type === "IN" && data.is_credit;
    const paidAmount = isCredit ? 0 : data.amount;
    const { error, data: row } = await supabase
      .from("transactions")
      .insert({
        user_id: ownerId,
        type: data.type,
        amount: data.amount,
        label: data.label ?? null,
        category: data.category ?? null,
        nature: data.nature ?? null,
        third_party: data.third_party ?? null,
        is_personal: data.is_personal,
        is_credit: isCredit,
        paid_amount: paidAmount,
        source: "MANUEL",
        validation_status: "VALIDE",
        occurred_at: data.occurred_at ?? new Date().toISOString(),
        activity_id: activityId,
        pos_id: posId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { transaction: row };
  });

// ----- Receivables (créances clients) -----

export const listReceivables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        activityId: z.union([z.string().uuid(), z.literal("ALL")]).optional(),
        posId: z.union([z.string().uuid(), z.literal("ALL")]).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getEffectiveOwnerId(supabase, userId);
    const activityFilter = await resolveActivityFilter(supabase, userId, data.activityId);
    const posFilter = await resolvePosFilter(supabase, userId, data.posId);
    let q = supabase
      .from("transactions")
      .select(
        "id, amount, paid_amount, label, third_party, category, occurred_at, activity_id, pos_id",
      )
      .eq("user_id", ownerId)
      .eq("is_credit", true)
      .eq("type", "IN")
      .order("occurred_at", { ascending: false })
      .limit(500);
    if (activityFilter) q = q.eq("activity_id", activityFilter);
    if (posFilter) q = q.eq("pos_id", posFilter);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const open = (rows ?? []).filter(
      (r) => Number(r.paid_amount) < Number(r.amount),
    );
    const total = open.reduce(
      (s, r) => s + (Number(r.amount) - Number(r.paid_amount)),
      0,
    );
    return { receivables: open, totalDue: total };
  });

export const recordCreditPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        payment: z.number().positive().max(1_000_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getEffectiveOwnerId(supabase, userId);
    const { data: row, error: e1 } = await supabase
      .from("transactions")
      .select("id, amount, paid_amount, is_credit, type")
      .eq("id", data.id)
      .eq("user_id", ownerId)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!row) throw new Error("Transaction introuvable");
    if (!row.is_credit || row.type !== "IN")
      throw new Error("Cette transaction n'est pas une vente différée.");
    const current = Number(row.paid_amount);
    const total = Number(row.amount);
    const newPaid = Math.min(total, current + data.payment);
    const { error } = await supabase
      .from("transactions")
      .update({ paid_amount: newPaid })
      .eq("id", data.id)
      .eq("user_id", ownerId);
    if (error) throw new Error(error.message);
    return { ok: true, paid_amount: newPaid, fully_paid: newPaid >= total };
  });



export const validateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), category: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getEffectiveOwnerId(supabase, userId);
    const patch: { validation_status: "VALIDE"; category?: string } = {
      validation_status: "VALIDE",
    };
    if (data.category) patch.category = data.category;
    const { error } = await supabase
      .from("transactions")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", ownerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const UpdateInput = z.object({
  id: z.string().uuid(),
  type: z.enum(["IN", "OUT"]).optional(),
  amount: z.number().positive().max(1_000_000_000).optional(),
  label: z.string().max(255).optional().nullable(),
  category: z.string().max(64).optional().nullable(),
  third_party: z.string().max(255).optional().nullable(),
  is_personal: z.boolean().optional(),
  is_credit: z.boolean().optional(),
  occurred_at: z.string().optional(),
});

export const updateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId, isSeller } = await getEffectiveOwnerId(supabase, userId);
    if (isSeller) throw new Error("Les vendeurs ne peuvent pas modifier une transaction.");
    const { id, ...patch } = data;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) clean[k] = v;
    }
    // When toggling is_credit, also adjust paid_amount for receivables tracking
    if (patch.is_credit !== undefined) {
      const { data: row } = await supabase
        .from("transactions")
        .select("amount")
        .eq("id", id)
        .eq("user_id", ownerId)
        .maybeSingle();
      if (row) clean.paid_amount = patch.is_credit ? 0 : Number(row.amount);
    }
    const { error } = await supabase
      .from("transactions")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(clean as any)
      .eq("id", id)
      .eq("user_id", ownerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId, isSeller } = await getEffectiveOwnerId(supabase, userId);
    if (isSeller) throw new Error("Les vendeurs ne peuvent pas supprimer une transaction.");
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", ownerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ListInput = z.object({
  from: z.string().optional().nullable(),
  to: z.string().optional().nullable(),
  activityId: z.union([z.string().uuid(), z.literal("ALL")]).optional(),
  posId: z.union([z.string().uuid(), z.literal("ALL")]).optional(),
});

export const listAllTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { ownerId } = await getEffectiveOwnerId(supabase, userId);
    const activityFilter = await resolveActivityFilter(supabase, userId, data.activityId);
    const posFilter = await resolvePosFilter(supabase, userId, data.posId);
    let q = supabase
      .from("transactions")
      .select(
        "id, type, amount, label, category, source, validation_status, occurred_at, is_personal, activity_id, pos_id",
      )
      .eq("user_id", ownerId)
      .order("occurred_at", { ascending: false })
      .limit(1000);
    if (data.from) q = q.gte("occurred_at", data.from);
    if (data.to) q = q.lte("occurred_at", data.to);
    if (activityFilter) q = q.eq("activity_id", activityFilter);
    if (posFilter) q = q.eq("pos_id", posFilter);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { transactions: rows ?? [] };
  });

