import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ------- Helpers (used by other server fns; not exposed as RPC) -------

// ---------------------------------------------------------------

async function getEffectiveOwner(supabase: unknown, userId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data } = await sb
    .from("profiles")
    .select("owner_user_id, role_in_pos")
    .eq("id", userId)
    .single();
  return data?.role_in_pos === "SELLER" && data?.owner_user_id ? data.owner_user_id : userId;
}

async function getProfileActive(supabase: unknown, userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const ownerId = await getEffectiveOwner(sb, userId);
  // Security-definer RPC so sellers inherit the owner's active activity
  // without direct SELECT access on the owner profile row.
  const { data } = await sb.rpc("get_owner_active_activity_id", { _uid: userId });
  return { supabase: sb, ownerId, activeId: (data as string | null) ?? null };
}

/**
 * Resolves the activity_id to use as filter.
 *  - "ALL" → null (no filter)
 *  - undefined → user's active_activity_id (or null if none)
 *  - uuid → that uuid
 */
export async function resolveActivityFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  activityId?: string | "ALL" | null,
): Promise<string | null> {
  if (activityId === "ALL") return null;
  if (activityId) return activityId;
  const { activeId } = await getProfileActive(supabase, userId);
  return activeId;
}

/** For inserts: rattachement automatique à l'activité active. */
export async function getActiveActivityId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<string | null> {
  const { activeId } = await getProfileActive(supabase, userId);
  return activeId;
}


// ------- Server functions -------

export const listMyActivities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const ownerId = await getEffectiveOwner(supabase, userId);
    const isSeller = ownerId !== userId;
    const [{ data: rows, error }, { data: ownerActiveId }] = await Promise.all([
      supabase
        .from("activities")
        .select("id, name, emoji, is_archived, created_at")
        .eq("user_id", ownerId)
        .order("created_at", { ascending: true }),
      supabase.rpc("get_owner_active_activity_id", { _uid: userId }),
    ]);
    if (error) throw new Error(error.message);
    let activities = rows ?? [];
    let activeId: string | null = (ownerActiveId as string | null) ?? null;

    // Self-heal : si l'utilisateur n'a aucune activité, en créer une par défaut (sauf vendeur).
    if (activities.length === 0 && !isSeller) {
      const { data: created, error: cErr } = await supabase
        .from("activities")
        .insert({ user_id: ownerId, name: "Mon activité", emoji: "💼" })
        .select("id, name, emoji, is_archived, created_at")
        .single();
      if (cErr) throw new Error(cErr.message);
      activities = [created];
      await supabase.from("profiles").update({ active_activity_id: created.id }).eq("id", ownerId);
      activeId = created.id;
    } else if (!isSeller && (!activeId || !activities.some((a) => a.id === activeId && !a.is_archived))) {
      // Active id invalide ou archivée → bascule sur la première active
      const fallback = activities.find((a) => !a.is_archived) ?? activities[0];
      if (fallback) {
        await supabase.from("profiles").update({ active_activity_id: fallback.id }).eq("id", ownerId);
        activeId = fallback.id;
      }
    }
    return { activities, activeId };
  });


export const createActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(80),
        emoji: z.string().max(8).optional().nullable(),
        setActive: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("activities")
      .insert({ user_id: userId, name: data.name.trim(), emoji: data.emoji ?? null })
      .select("id, name, emoji, is_archived, created_at")
      .single();
    if (error) throw new Error(error.message);
    if (data.setActive) {
      await supabase.from("profiles").update({ active_activity_id: row.id }).eq("id", userId);
    }
    return { activity: row };
  });

export const updateActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(80).optional(),
        emoji: z.string().max(8).optional().nullable(),
        is_archived: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) clean[k] = v;
    const { error } = await supabase
      .from("activities")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(clean as any)
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Sécurité minimale : ne pas supprimer la dernière activité.
    const { data: all } = await supabase
      .from("activities")
      .select("id")
      .eq("user_id", userId);
    if (!all || all.length <= 1) {
      throw new Error("Vous devez conserver au moins une activité. Renommez-la plutôt.");
    }
    const { error } = await supabase
      .from("activities")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    // Si on a supprimé l'active, basculer sur une autre.
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_activity_id")
      .eq("id", userId)
      .single();
    if (!profile?.active_activity_id || profile.active_activity_id === data.id) {
      const other = all.find((a) => a.id !== data.id);
      if (other) await supabase.from("profiles").update({ active_activity_id: other.id }).eq("id", userId);
    }
    return { ok: true };
  });

export const setActiveActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid().nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ownerId = await getEffectiveOwner(supabase, userId);
    if (ownerId !== userId) throw new Error("Action réservée au propriétaire.");
    if (data.id) {
      const { data: own } = await supabase
        .from("activities")
        .select("id")
        .eq("id", data.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (!own) throw new Error("Activité introuvable");
    }
    const { error } = await supabase
      .from("profiles")
      .update({ active_activity_id: data.id })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ------- Coach side -------

export const listEntrepreneurActivities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ entrepreneurId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("activities")
      .select("id, name, emoji, is_archived, created_at")
      .eq("user_id", data.entrepreneurId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { activities: rows ?? [] };
  });
