import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès refusé (admin uniquement)");
}

// Fetch all auth users (paginated) and return a map id -> {email, last_sign_in_at, banned_until}
async function fetchAuthUsersMap() {
  const map = new Map<string, { email: string | null; last_sign_in_at: string | null; banned_until: string | null }>();
  let page = 1;
  // perPage default is 50, cap to 200 pages just in case
  for (let i = 0; i < 200; i++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    for (const u of data.users) {
      map.set(u.id, {
        email: u.email ?? null,
        last_sign_in_at: (u as { last_sign_in_at?: string | null }).last_sign_in_at ?? null,
        banned_until: (u as { banned_until?: string | null }).banned_until ?? null,
      });
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  return map;
}

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, full_name, business_name, region, sector, phone, status, legal_status, ninea, rccm, founding_year, team_size, avatar_url, activity_description, sales_channel, whatsapp_link, development_stage, priority_needs, annual_revenue, annual_expenses, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const byUser: Record<string, string[]> = {};
    for (const r of roles ?? []) (byUser[r.user_id] ||= []).push(r.role as string);

    const authMap = await fetchAuthUsersMap();

    return {
      users: (profiles ?? []).map((p) => {
        const a = authMap.get(p.id);
        return {
          ...p,
          roles: byUser[p.id] ?? [],
          email: a?.email ?? null,
          last_sign_in_at: a?.last_sign_in_at ?? null,
          banned_until: a?.banned_until ?? null,
        };
      }),
    };
  });

export const adminListAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("coach_assignments")
      .select("id, coach_id, entrepreneur_id, assigned_at");
    if (error) throw new Error(error.message);
    return { assignments: data ?? [] };
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "coach", "entrepreneur"]),
        action: z.enum(["add", "remove"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.action === "add") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminAssignCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        coachId: z.string().uuid(),
        entrepreneurId: z.string().uuid(),
        action: z.enum(["add", "remove"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.action === "add") {
      const { error } = await supabaseAdmin
        .from("coach_assignments")
        .insert({ coach_id: data.coachId, entrepreneur_id: data.entrepreneurId });
      if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("coach_assignments")
        .delete()
        .eq("coach_id", data.coachId)
        .eq("entrepreneur_id", data.entrepreneurId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// === Création / gestion d'utilisateurs ===

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8).max(128).optional(),
        mode: z.enum(["direct", "invite"]),
        full_name: z.string().min(1).max(120).optional(),
        phone: z.string().max(40).optional(),
        business_name: z.string().max(160).optional(),
        region: z.string().max(80).optional(),
        sector: z.string().max(80).optional(),
        role: z.enum(["entrepreneur", "coach", "admin"]).default("entrepreneur"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    let newUserId: string;
    if (data.mode === "invite") {
      const { data: res, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: { full_name: data.full_name, phone: data.phone },
      });
      if (error) throw new Error(error.message);
      newUserId = res.user!.id;
    } else {
      if (!data.password) throw new Error("Mot de passe requis pour la création directe");
      const { data: res, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name, phone: data.phone },
      });
      if (error) throw new Error(error.message);
      newUserId = res.user!.id;
    }

    // upsert profile fields (trigger creates baseline)
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name ?? null,
        phone: data.phone ?? null,
        business_name: data.business_name ?? null,
        region: data.region ?? null,
        sector: data.sector ?? null,
      })
      .eq("id", newUserId);

    if (data.role !== "entrepreneur") {
      await supabaseAdmin.from("user_roles").insert({ user_id: newUserId, role: data.role });
    }
    return { ok: true, userId: newUserId };
  });

export const adminUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        patch: z
          .object({
            full_name: z.string().max(120).nullable().optional(),
            phone: z.string().max(40).nullable().optional(),
            business_name: z.string().max(160).nullable().optional(),
            region: z.string().max(80).nullable().optional(),
            sector: z.string().max(80).nullable().optional(),
            legal_status: z.string().max(80).nullable().optional(),
            ninea: z.string().max(40).nullable().optional(),
            rccm: z.string().max(40).nullable().optional(),
            founding_year: z.number().int().min(1900).max(2100).nullable().optional(),
            team_size: z.number().int().min(0).max(100000).nullable().optional(),
            avatar_url: z.string().max(500).nullable().optional(),
            activity_description: z.string().max(2000).nullable().optional(),
            sales_channel: z.string().max(120).nullable().optional(),
            whatsapp_link: z.string().max(300).nullable().optional(),
            development_stage: z.string().max(80).nullable().optional(),
            priority_needs: z.array(z.string().max(80)).max(20).nullable().optional(),
            annual_revenue: z.number().nullable().optional(),
            annual_expenses: z.number().nullable().optional(),
          })
          .strict(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update(data.patch)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(8).max(128) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminBanUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), banned: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    // 100 years if banned, "none" to unban
    const ban_duration = data.banned ? "876000h" : "none";
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration,
    } as Parameters<typeof supabaseAdmin.auth.admin.updateUserById>[1]);
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .update({ status: data.banned ? "suspended" : "active" })
      .eq("id", data.userId);
    return { ok: true };
  });

// === Métriques admin avec filtres ===

export const adminMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        from: z.string().datetime().nullable().optional(),
        to: z.string().datetime().nullable().optional(),
        region: z.string().nullable().optional(),
        sector: z.string().nullable().optional(),
        coachId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // 1) Profils filtrés (region, sector, coach)
    let profilesQ = supabaseAdmin
      .from("profiles")
      .select(
        "id, business_name, full_name, region, sector, status, created_at, annual_revenue, annual_expenses",
      );
    if (data.region) profilesQ = profilesQ.eq("region", data.region);
    if (data.sector) profilesQ = profilesQ.eq("sector", data.sector);
    const { data: allProfiles, error: pErr } = await profilesQ;
    if (pErr) throw new Error(pErr.message);

    let scopeIds = (allProfiles ?? []).map((p) => p.id);
    if (data.coachId) {
      const { data: assigns } = await supabaseAdmin
        .from("coach_assignments")
        .select("entrepreneur_id")
        .eq("coach_id", data.coachId);
      const set = new Set((assigns ?? []).map((a) => a.entrepreneur_id));
      scopeIds = scopeIds.filter((id) => set.has(id));
    }

    const scopedProfiles = (allProfiles ?? []).filter((p) => scopeIds.includes(p.id));
    const scopedSet = new Set(scopeIds);

    // 2) Transactions filtrées
    let txQ = supabaseAdmin
      .from("transactions")
      .select("id, user_id, type, amount, category, source, occurred_at, is_personal")
      .eq("is_personal", false);
    if (data.from) txQ = txQ.gte("occurred_at", data.from);
    if (data.to) txQ = txQ.lte("occurred_at", data.to);
    const { data: allTx, error: tErr } = await txQ;
    if (tErr) throw new Error(tErr.message);
    const txns = (allTx ?? []).filter((t) => scopedSet.has(t.user_id));

    // 3) KPIs financiers
    let income = 0;
    let expense = 0;
    let voiceCount = 0;
    const incomeByUser = new Map<string, number>();
    const txCountByUser = new Map<string, number>();
    const incomeBySector = new Map<string, number>();
    const expenseByCategory = new Map<string, number>();
    const profilesById = new Map(scopedProfiles.map((p) => [p.id, p]));

    for (const t of txns) {
      const amt = Number(t.amount) || 0;
      if (t.source === "VOICE") voiceCount++;
      txCountByUser.set(t.user_id, (txCountByUser.get(t.user_id) ?? 0) + 1);
      if (t.type === "IN") {
        income += amt;
        incomeByUser.set(t.user_id, (incomeByUser.get(t.user_id) ?? 0) + amt);
        const sec = profilesById.get(t.user_id)?.sector ?? "Non renseigné";
        incomeBySector.set(sec, (incomeBySector.get(sec) ?? 0) + amt);
      } else {
        expense += amt;
        const cat = t.category ?? "Non classé";
        expenseByCategory.set(cat, (expenseByCategory.get(cat) ?? 0) + amt);
      }
    }
    const gain = income - expense;
    const avgTicket = txns.length > 0 ? (income + expense) / txns.length : 0;

    // 4) Adoption : actifs 7j / 30j (basé sur transactions, qui ne respecte pas le filtre période pour rester pertinent)
    const now = Date.now();
    const since7 = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
    const since30 = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
    const { data: recentTx } = await supabaseAdmin
      .from("transactions")
      .select("user_id, occurred_at")
      .gte("occurred_at", since30);
    const active7 = new Set<string>();
    const active30 = new Set<string>();
    for (const t of recentTx ?? []) {
      if (!scopedSet.has(t.user_id)) continue;
      active30.add(t.user_id);
      if (t.occurred_at >= since7) active7.add(t.user_id);
    }

    // 5) Répartition par région / secteur (sur les profils scopés)
    const byRegion: Record<string, number> = {};
    const bySector: Record<string, number> = {};
    for (const p of scopedProfiles) {
      const r = p.region ?? "Non renseigné";
      const s = p.sector ?? "Non renseigné";
      byRegion[r] = (byRegion[r] ?? 0) + 1;
      bySector[s] = (bySector[s] ?? 0) + 1;
    }

    // 6) Top entreprises (ventes & assiduité)
    const topByRevenue = [...incomeByUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, amount]) => ({
        id,
        name: profilesById.get(id)?.business_name ?? profilesById.get(id)?.full_name ?? id.slice(0, 8),
        amount,
      }));
    const topByActivity = [...txCountByUser.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => ({
        id,
        name: profilesById.get(id)?.business_name ?? profilesById.get(id)?.full_name ?? id.slice(0, 8),
        count,
      }));

    // 7) Évolution mensuelle (12 derniers mois) — recettes / charges
    const monthlySeries = new Map<string, { in: number; out: number }>();
    const seriesStart = new Date(now);
    seriesStart.setMonth(seriesStart.getMonth() - 11);
    seriesStart.setDate(1);
    const { data: seriesTx } = await supabaseAdmin
      .from("transactions")
      .select("type, amount, user_id, occurred_at")
      .gte("occurred_at", seriesStart.toISOString())
      .eq("is_personal", false);
    for (let i = 0; i < 12; i++) {
      const d = new Date(seriesStart);
      d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlySeries.set(key, { in: 0, out: 0 });
    }
    for (const t of seriesTx ?? []) {
      if (!scopedSet.has(t.user_id)) continue;
      const d = new Date(t.occurred_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = monthlySeries.get(key);
      if (!cur) continue;
      const amt = Number(t.amount) || 0;
      if (t.type === "IN") cur.in += amt;
      else cur.out += amt;
    }

    return {
      filtersUsed: data,
      kpis: {
        totalUsers: scopedProfiles.length,
        active7: active7.size,
        active30: active30.size,
        txCount: txns.length,
        income,
        expense,
        gain,
        avgTicket,
        voiceShare: txns.length > 0 ? voiceCount / txns.length : 0,
      },
      byRegion,
      bySector,
      incomeBySector: Object.fromEntries(incomeBySector),
      expenseByCategory: Object.fromEntries(expenseByCategory),
      topByRevenue,
      topByActivity,
      monthlySeries: [...monthlySeries.entries()].map(([month, v]) => ({ month, ...v })),
    };
  });

// Pour peupler les listes de filtres
export const adminFilterOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: profiles } = await supabaseAdmin.from("profiles").select("region, sector");
    const regions = Array.from(
      new Set((profiles ?? []).map((p) => p.region).filter(Boolean) as string[]),
    ).sort();
    const sectors = Array.from(
      new Set((profiles ?? []).map((p) => p.sector).filter(Boolean) as string[]),
    ).sort();
    // Coachs
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "coach");
    const coachIds = (roleRows ?? []).map((r) => r.user_id);
    const { data: coachProfiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, business_name")
      .in("id", coachIds.length > 0 ? coachIds : ["00000000-0000-0000-0000-000000000000"]);
    return {
      regions,
      sectors,
      coaches: (coachProfiles ?? []).map((c) => ({
        id: c.id,
        name: c.full_name ?? c.business_name ?? c.id.slice(0, 8),
      })),
    };
  });

export const adminListDraftsAndErrors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const [{ data: drafts }, { data: errors }] = await Promise.all([
      supabaseAdmin
        .from("transactions")
        .select("id, user_id, type, amount, label, category, source, transcript, occurred_at")
        .eq("validation_status", "A_VALIDER")
        .order("occurred_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("ai_errors")
        .select("id, user_id, source, transcript, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return { drafts: drafts ?? [], errors: errors ?? [] };
  });

export const adminApproveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("transactions")
      .update({ validation_status: "VALIDE" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Garde-fou : conserver l'export `adminStats` (utilisé ailleurs) en alias léger.
export const adminStats = adminMetrics;
