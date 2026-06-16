import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error) throw new Error(error.message);
    return { profile: data };
  });

const ProfilePatch = z.object({
  full_name: z.string().max(255).nullable().optional(),
  business_name: z.string().max(255).nullable().optional(),
  phone: z.string().max(64).nullable().optional(),
  whatsapp_link: z.string().max(255).nullable().optional(),
  region: z.string().max(64).nullable().optional(),
  sector: z.string().max(128).nullable().optional(),
  legal_status: z.string().max(64).nullable().optional(),
  ninea: z.string().max(64).nullable().optional(),
  rccm: z.string().max(64).nullable().optional(),
  founding_year: z.number().int().min(1900).max(2100).nullable().optional(),
  team_size: z.number().int().min(0).max(100000).nullable().optional(),
  avatar_url: z.string().max(1024).nullable().optional(),
  activity_description: z.string().max(2000).nullable().optional(),
  sales_channel: z.string().max(128).nullable().optional(),
  development_stage: z.string().max(64).nullable().optional(),
  priority_needs: z.array(z.string().max(64)).max(20).nullable().optional(),
  annual_revenue: z.number().nullable().optional(),
  annual_expenses: z.number().nullable().optional(),
  language: z.enum(["fr", "wo"]).optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ProfilePatch.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").update(data).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ days: z.number().int().min(1).max(3650).default(90) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const { data: txns, error } = await supabase
      .from("transactions")
      .select("type, amount, category, third_party, occurred_at, source, label, nature")
      .eq("user_id", userId)
      .eq("is_personal", false)
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false });
    if (error) throw new Error(error.message);

    const list = txns ?? [];
    let income = 0;
    let expense = 0;
    const expByCat = new Map<string, number>();
    const incByCat = new Map<string, number>();
    const bySource = new Map<string, number>();
    const monthly = new Map<string, { in: number; out: number }>();

    for (const t of list) {
      const amt = Number(t.amount) || 0;
      const cat = (t.category || "Non catégorisé").trim();
      const src = (t.source || "MANUEL") as string;
      bySource.set(src, (bySource.get(src) || 0) + 1);
      const ym = (t.occurred_at || "").slice(0, 7);
      const m = monthly.get(ym) || { in: 0, out: 0 };
      if (t.type === "IN") {
        income += amt;
        incByCat.set(cat, (incByCat.get(cat) || 0) + amt);
        m.in += amt;
      } else {
        expense += amt;
        expByCat.set(cat, (expByCat.get(cat) || 0) + amt);
        m.out += amt;
      }
      monthly.set(ym, m);
    }

    const toArr = (m: Map<string, number>) =>
      Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return {
      totals: { income, expense, balance: income - expense, count: list.length },
      expensesByCategory: toArr(expByCat),
      incomeByCategory: toArr(incByCat),
      bySource: Array.from(bySource, ([name, value]) => ({ name, value })),
      monthly: Array.from(monthly, ([month, v]) => ({ month, ...v })).sort((a, b) =>
        a.month.localeCompare(b.month),
      ),
    };
  });

export const listByCategory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ category: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("transactions")
      .select("id, type, amount, label, category, third_party, occurred_at, source")
      .eq("user_id", userId)
      .eq("category", data.category)
      .order("occurred_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { items: rows ?? [] };
  });
