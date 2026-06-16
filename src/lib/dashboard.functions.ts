import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActivityFilter } from "./activities.functions";
import { resolvePosFilter } from "./pos.functions";

const Input = z.object({
  period: z.enum(["day", "month", "year"]).default("day"),
  activityId: z.union([z.string().uuid(), z.literal("ALL")]).optional(),
  posId: z.union([z.string().uuid(), z.literal("ALL")]).optional(),
});

function periodStart(period: "day" | "month" | "year"): Date {
  const d = new Date();
  if (period === "day") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "month") {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const fromIso = periodStart(data.period).toISOString();
    const activityFilter = await resolveActivityFilter(supabase, userId, data.activityId);
    const posFilter = await resolvePosFilter(supabase, userId, data.posId);

    // For sellers the RLS already enforces scope; for owners we still want their full data unless a posId is provided.
    // Resolve effective owner id so the dashboard works for sellers (data still belongs to owner.user_id).
    const { data: prof } = await supabase
      .from("profiles")
      .select("owner_user_id, role_in_pos")
      .eq("id", userId)
      .single();
    const effectiveOwnerId =
      prof?.role_in_pos === "SELLER" && prof?.owner_user_id ? prof.owner_user_id : userId;

    let q = supabase
      .from("transactions")
      .select(
        "id, type, amount, label, category, source, validation_status, occurred_at, is_personal, activity_id, pos_id",
      )
      .eq("user_id", effectiveOwnerId)
      .eq("is_personal", false)
      .gte("occurred_at", fromIso)
      .order("occurred_at", { ascending: false })
      .limit(1000);
    if (activityFilter) q = q.eq("activity_id", activityFilter);
    if (posFilter) q = q.eq("pos_id", posFilter);

    const { data: txns, error } = await q;
    if (error) throw new Error(error.message);

    const list = txns ?? [];
    let income = 0;
    let expense = 0;
    for (const t of list) {
      const amt = Number(t.amount) || 0;
      if (t.type === "IN") income += amt;
      else if (t.type === "OUT") expense += amt;
    }
    const gain = income - expense;
    const reserve = Math.max(0, gain * 0.6);
    const available = Math.max(0, gain * 0.4);
    const denom = Math.max(income, expense, 1);
    const health = Math.max(-100, Math.min(100, Math.round((gain / denom) * 100)));
    const pending = list.filter((t) => t.validation_status === "A_VALIDER");

    return {
      totals: { income, expense, gain, available, reserve, health },
      transactions: list,
      pending,
      period: data.period,
      activityFilter,
      posFilter,
    };
  });
