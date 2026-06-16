import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PinInput = z.object({ pin: z.string().regex(/^\d{4}$/) });

export const setPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PinInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(data.pin, salt);

    // CORRECTION : Utilisation de la fonction RPC au lieu de .update sur profiles
    const { error } = await supabase.rpc("upsert_my_pin", {
      p_pin_hash: hash,
      p_pin_salt: salt,
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const verifyPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => PinInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: hash, error } = await supabase.rpc("get_my_pin_hash");
    if (error) throw new Error(error.message);
    if (!hash) return { ok: false, reason: "no_pin" as const };
    const ok = bcrypt.compareSync(data.pin, hash as unknown as string);
    return { ok };
  });

export const changePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        currentPin: z.string().regex(/^\d{4}$/),
        newPin: z.string().regex(/^\d{4}$/),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: hash, error } = await supabase.rpc("get_my_pin_hash");
    if (error) throw new Error(error.message);
    if (!hash) throw new Error("Aucun code PIN défini");
    if (!bcrypt.compareSync(data.currentPin, hash as unknown as string)) {
      throw new Error("Code PIN actuel incorrect");
    }
    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(data.newPin, salt);

    // CORRECTION : Utilisation de la fonction RPC au lieu de .update sur profiles
    const { error: upErr } = await supabase.rpc("upsert_my_pin", {
      p_pin_hash: newHash,
      p_pin_salt: salt,
    });

    if (upErr) throw new Error(upErr.message);
    return { ok: true };
  });

export const hasPinSet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: hash, error }, { data: prof }] = await Promise.all([
      supabase.rpc("get_my_pin_hash"),
      supabase.from("profiles").select("full_name").eq("id", userId).single(),
    ]);
    if (error) throw new Error(error.message);
    return { hasPin: !!hash, fullName: prof?.full_name ?? null };
  });
