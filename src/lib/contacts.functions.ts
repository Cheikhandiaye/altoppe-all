import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActivityFilter, getActiveActivityId } from "./activities.functions";

const ContactType = z.enum(["CLIENT", "FOURNISSEUR"]);

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        type: ContactType.optional(),
        activityId: z.union([z.string().uuid(), z.literal("ALL")]).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const activityFilter = await resolveActivityFilter(supabase, userId, data.activityId);
    let q = supabase
      .from("contacts")
      .select("id, name, type, phone, email, notes, activity_id, created_at")
      .eq("user_id", userId)
      .order("name", { ascending: true });
    if (data.type) q = q.eq("type", data.type);
    if (activityFilter) q = q.eq("activity_id", activityFilter);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { contacts: rows ?? [] };
  });

const CreateInput = z.object({
  name: z.string().min(1).max(255),
  type: ContactType,
  phone: z.string().max(64).optional().nullable(),
  email: z.string().max(255).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  activityId: z.string().uuid().optional(),
});

export const createContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const activityId = data.activityId ?? (await getActiveActivityId(supabase, userId));
    const { data: row, error } = await supabase
      .from("contacts")
      .insert({
        user_id: userId,
        name: data.name.trim(),
        type: data.type,
        phone: data.phone || null,
        email: data.email || null,
        notes: data.notes || null,
        activity_id: activityId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { contact: row };
  });


const UpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  type: ContactType.optional(),
  phone: z.string().max(64).optional().nullable(),
  email: z.string().max(255).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) clean[k] = v;
    const { error } = await supabase
      .from("contacts")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(clean as any)
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getContactStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ days: z.number().int().min(1).max(3650).default(180) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();
    const { data: txns, error } = await supabase
      .from("transactions")
      .select("type, amount, third_party, occurred_at")
      .eq("user_id", userId)
      .eq("is_personal", false)
      .gte("occurred_at", since)
      .not("third_party", "is", null)
      .order("occurred_at", { ascending: true });
    if (error) throw new Error(error.message);

    type Agg = { name: string; count: number; total: number; dates: number[] };
    const clients = new Map<string, Agg>();
    const suppliers = new Map<string, Agg>();

    for (const t of txns ?? []) {
      const raw = (t.third_party ?? "").trim();
      if (!raw) continue;
      const amt = Number(t.amount) || 0;
      const ts = new Date(t.occurred_at).getTime();
      const bucket = t.type === "IN" ? clients : suppliers;
      const cur = bucket.get(raw) ?? { name: raw, count: 0, total: 0, dates: [] };
      cur.count += 1;
      cur.total += amt;
      cur.dates.push(ts);
      bucket.set(raw, cur);
    }

    const summarize = (m: Map<string, Agg>) =>
      Array.from(m.values())
        .map((a) => {
          let intervalDays: number | null = null;
          if (a.dates.length >= 2) {
            const sorted = [...a.dates].sort((x, y) => x - y);
            let sum = 0;
            for (let i = 1; i < sorted.length; i++) sum += sorted[i] - sorted[i - 1];
            intervalDays = sum / (sorted.length - 1) / 86400_000;
          }
          return {
            name: a.name,
            count: a.count,
            total: a.total,
            avgTicket: a.total / a.count,
            intervalDays,
          };
        })
        .sort((x, y) => y.total - x.total);

    return {
      clients: summarize(clients),
      suppliers: summarize(suppliers),
    };
  });
