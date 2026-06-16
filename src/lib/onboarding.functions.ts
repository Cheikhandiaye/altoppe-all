import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RequiredProfile = z.object({
  full_name: z.string().trim().min(1).max(255),
  phone: z.string().trim().min(4).max(64),
  region: z.string().trim().min(1).max(64),
  sector: z.string().trim().min(1).max(128),
  legal_status: z.string().trim().min(1).max(64),
  // Ces trois champs acceptent désormais d'être vides ou absents :
  business_name: z.string().trim().max(255).optional().or(z.literal("")),
  development_stage: z.string().trim().max(64).optional().or(z.literal("")),
  sales_channel: z.string().trim().max(128).optional().or(z.literal("")),
});

export const saveOnboardingProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RequiredProfile.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").update(data).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
