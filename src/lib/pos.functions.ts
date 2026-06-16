import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ----- Helpers -----

/**
 * Returns the effective owner id for this user
 *  - owner → returns userId itself
 *  - seller → returns owner_user_id
 */
export async function getEffectiveOwnerId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<{ ownerId: string; isSeller: boolean; sellerPosId: string | null; activePosId: string | null }> {
  const { data } = await supabase
    .from("profiles")
    .select("owner_user_id, pos_id, role_in_pos, active_pos_id")
    .eq("id", userId)
    .single();
  const isSeller = data?.role_in_pos === "SELLER" && !!data?.owner_user_id;
  return {
    ownerId: isSeller ? (data!.owner_user_id as string) : userId,
    isSeller,
    sellerPosId: isSeller ? ((data?.pos_id as string | null) ?? null) : null,
    activePosId: (data?.active_pos_id as string | null) ?? null,
  };
}

async function firstNonArchivedPosId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  ownerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("points_of_sale")
    .select("id")
    .eq("owner_user_id", ownerId)
    .eq("is_archived", false)
    .order("created_at", { ascending: true })
    .limit(1);
  return data?.[0]?.id ?? null;
}

/**
 * Resolve the pos_id to use when inserting a transaction.
 *  - seller → forced to their own pos_id (input ignored)
 *  - owner → requestedPosId if it belongs to them, else active_pos_id, else first non-archived
 */
export async function resolveInsertPosId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  requestedPosId?: string | null,
): Promise<{ ownerId: string; posId: string | null }> {
  const { ownerId, isSeller, sellerPosId, activePosId } = await getEffectiveOwnerId(supabase, userId);
  if (isSeller) return { ownerId, posId: sellerPosId };

  if (requestedPosId) {
    const { data: pv } = await supabase
      .from("points_of_sale")
      .select("id")
      .eq("id", requestedPosId)
      .eq("owner_user_id", ownerId)
      .maybeSingle();
    if (pv) return { ownerId, posId: requestedPosId };
  }

  if (activePosId) {
    const { data: pv } = await supabase
      .from("points_of_sale")
      .select("id, is_archived")
      .eq("id", activePosId)
      .eq("owner_user_id", ownerId)
      .maybeSingle();
    if (pv && !pv.is_archived) return { ownerId, posId: activePosId };
  }

  return { ownerId, posId: await firstNonArchivedPosId(supabase, ownerId) };
}

/**
 * Resolve a SELECT filter for transactions/lists.
 *  - "ALL" → no filter (used by coach to see everything)
 *  - uuid → that pos
 *  - null/undefined → seller: forced to sellerPosId; owner: defaults to active_pos_id (cloisonnement par défaut)
 */
export async function resolvePosFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  posId?: string | "ALL" | null,
): Promise<string | null> {
  if (posId === "ALL") return null;
  if (posId) return posId;
  const { isSeller, sellerPosId, activePosId } = await getEffectiveOwnerId(supabase, userId);
  if (isSeller) return sellerPosId;
  return activePosId;
}

// ----- Active POS (owner default) -----

export const getActivePOS = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { activePosId, isSeller, sellerPosId, ownerId } = await getEffectiveOwnerId(supabase, userId);
    // Self-heal: si pas d'active_pos_id pour un owner, prendre le premier non archivé et persister.
    if (!isSeller && !activePosId) {
      const first = await firstNonArchivedPosId(supabase, ownerId);
      if (first) {
        await supabase.from("profiles").update({ active_pos_id: first }).eq("id", userId);
        return { activePosId: first, isSeller: false, sellerPosId: null };
      }
    }
    return {
      activePosId: isSeller ? sellerPosId : activePosId,
      isSeller,
      sellerPosId,
    };
  });

export const setActivePOSFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ posId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { isSeller } = await getEffectiveOwnerId(supabase, userId);
    if (isSeller) throw new Error("Un vendeur ne peut pas changer de point de vente.");
    // Verify ownership
    const { data: pv } = await supabase
      .from("points_of_sale")
      .select("id")
      .eq("id", data.posId)
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!pv) throw new Error("Point de vente introuvable");
    const { error } = await supabase.from("profiles").update({ active_pos_id: data.posId }).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Server functions : owner -----

const POS_CODE = z
  .string()
  .min(1)
  .max(12)
  .regex(/^[A-Za-z0-9_-]+$/, "Code : lettres, chiffres, - ou _ uniquement");

export const listMyPOS = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { ownerId, isSeller, sellerPosId, activePosId } = await getEffectiveOwnerId(supabase, userId);
    const { data, error } = await supabase
      .from("points_of_sale")
      .select("id, code, name, is_archived, created_at")
      .eq("owner_user_id", ownerId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    // Self-heal pour owner sans active_pos_id
    let effectiveActive = isSeller ? sellerPosId : activePosId;
    if (!isSeller && !effectiveActive) {
      const first = (data ?? []).find((p: { id: string; is_archived: boolean }) => !p.is_archived);
      if (first) {
        effectiveActive = first.id;
        await supabase.from("profiles").update({ active_pos_id: first.id }).eq("id", userId);
      }
    }
    return {
      pos: data ?? [],
      isSeller,
      sellerPosId,
      activePosId: effectiveActive,
      ownerId,
    };
  });

export const createPOS = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ code: POS_CODE, name: z.string().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("points_of_sale")
      .insert({ owner_user_id: userId, code: data.code.trim(), name: data.name.trim() })
      .select("id, code, name, is_archived, created_at")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Ce code PV existe déjà.");
      throw new Error(error.message);
    }
    return { pos: row };
  });

export const updatePOS = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        code: POS_CODE.optional(),
        name: z.string().min(1).max(80).optional(),
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
      .from("points_of_sale")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(clean as any)
      .eq("id", id)
      .eq("owner_user_id", userId);
    if (error) {
      if (error.code === "23505") throw new Error("Ce code PV existe déjà.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const deletePOS = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Don't delete if last one
    const { data: all } = await supabase
      .from("points_of_sale")
      .select("id")
      .eq("owner_user_id", userId);
    if (!all || all.length <= 1)
      throw new Error("Vous devez conserver au moins un point de vente. Archivez-le plutôt.");
    const { error } = await supabase
      .from("points_of_sale")
      .delete()
      .eq("id", data.id)
      .eq("owner_user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Sellers (owner-managed) -----

export const listMySellers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: sellers, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, pos_id, role_in_pos, owner_user_id, created_at")
      .eq("owner_user_id", userId)
      .eq("role_in_pos", "SELLER")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { sellers: sellers ?? [] };
  });

export const createSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        full_name: z.string().min(1).max(120),
        phone: z.string().min(6).max(40),
        password: z.string().min(8).max(128),
        pos_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify POS ownership
    const { data: pv } = await supabase
      .from("points_of_sale")
      .select("id")
      .eq("id", data.pos_id)
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!pv) throw new Error("Point de vente introuvable");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Synthetic deterministic email derived from the phone — owner shares it with seller for login.
    const sanitized = data.phone.replace(/\D/g, "");
    if (sanitized.length < 6) throw new Error("Numéro de téléphone invalide");
    const email = `pv-${sanitized}@altope.local`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,

      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        phone: data.phone,
        role_in_pos: "SELLER",
        owner_user_id: userId,
        pos_id: data.pos_id,
      },
    });
    if (error) throw new Error(error.message);
    const newId = created.user!.id;
    // The trigger reads metadata to set role/pos but double-write in case the trigger ignored metadata
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone,
        role_in_pos: "SELLER",
        owner_user_id: userId,
        pos_id: data.pos_id,
      })
      .eq("id", newId);
    return { ok: true, sellerId: newId, login: email };
  });

export const resetSellerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ sellerId: z.string().uuid(), password: z.string().min(8).max(128) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify ownership
    const { data: prof } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", data.sellerId)
      .eq("owner_user_id", userId)
      .eq("role_in_pos", "SELLER")
      .maybeSingle();
    if (!prof) throw new Error("Vendeur introuvable");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.sellerId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ sellerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", data.sellerId)
      .eq("owner_user_id", userId)
      .eq("role_in_pos", "SELLER")
      .maybeSingle();
    if (!prof) throw new Error("Vendeur introuvable");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.sellerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Coach -----

export const listEntrepreneurPOS = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ entrepreneurId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("points_of_sale")
      .select("id, code, name, is_archived, created_at")
      .eq("owner_user_id", data.entrepreneurId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { pos: rows ?? [] };
  });
