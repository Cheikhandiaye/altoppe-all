import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile } from "@/lib/settings.functions";
import { saveOnboardingProfile } from "@/lib/onboarding.functions";
import { LEGAL_STATUSES, SALES_CHANNELS, DEV_STAGES, SENEGAL_REGIONS, SECTORS } from "@/lib/profile-constants";
import { Field, TextInput, SelectOrOther } from "@/components/profile/Field";

export const Route = createFileRoute("/_authenticated/_unlocked/onboarding/profile")({
  component: OnboardingProfilePage,
});

type Form = {
  full_name: string;
  business_name: string;
  phone: string;
  region: string;
  sector: string;
  legal_status: string;
  development_stage: string;
  sales_channel: string;
};

const EMPTY: Form = {
  full_name: "",
  business_name: "",
  phone: "",
  region: "",
  sector: "",
  legal_status: "",
  development_stage: "",
  sales_channel: "",
};

function OnboardingProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getMyProfile);
  const callSave = useServerFn(saveOnboardingProfile);
  const { data } = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });
  const [f, setF] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data?.profile) return;
    const p = data.profile;
    setF({
      full_name: p.full_name ?? "",
      business_name: p.business_name ?? "",
      phone: p.phone ?? "",
      region: p.region ?? "",
      sector: p.sector ?? "",
      legal_status: p.legal_status ?? "",
      development_stage: p.development_stage ?? "",
      sales_channel: p.sales_channel ?? "",
    });
  }, [data]);

  // CORRECTION : On valide uniquement les champs strictement obligatoires
  const valid = useMemo(() => {
    const requiredFields: (keyof Form)[] = ["full_name", "phone", "region", "sector", "legal_status"];
    return requiredFields.every((key) => f[key].trim().length > 0);
  }, [f]);

  const submit = async () => {
    if (!valid) {
      toast.error("Merci de remplir tous les champs obligatoires");
      return;
    }
    setSaving(true);
    try {
      await callSave({ data: f });
      navigate({ to: "/onboarding/tour", search: { step: 1 } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-brand-sand">
      <header className="bg-brand-green text-white px-5 pt-8 pb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-gold mb-2">Étape 1 / 2</p>
        <h1 className="font-display text-2xl font-bold">Bienvenue 👋</h1>
        <p className="text-sm text-white/70 mt-1">Quelques infos pour personnaliser AL-TOPPE.</p>
      </header>

      <main className="px-5 py-6 space-y-5 pb-32">
        <Section title="Vous">
          <Field label="Nom complet *">
            <TextInput value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          </Field>
          <Field label="Téléphone *">
            <TextInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+221 ..." />
          </Field>
        </Section>

        <Section title="Votre activité">
          {/* Étoile retirée ici */}
          <Field label="Nom de l'entreprise / GIE">
            <TextInput value={f.business_name} onChange={(e) => setF({ ...f, business_name: e.target.value })} />
          </Field>
          <SelectOrOther
            label="Statut juridique *"
            value={f.legal_status}
            onChange={(v) => setF({ ...f, legal_status: v })}
            options={LEGAL_STATUSES}
          />
          <SelectOrOther
            label="Région *"
            value={f.region}
            onChange={(v) => setF({ ...f, region: v })}
            options={SENEGAL_REGIONS}
          />
          <SelectOrOther
            label="Secteur d'activité *"
            value={f.sector}
            onChange={(v) => setF({ ...f, sector: v })}
            options={SECTORS}
          />
          {/* Étoile retirée ici */}
          <SelectOrOther
            label="Canal de vente principal"
            value={f.sales_channel}
            onChange={(v) => setF({ ...f, sales_channel: v })}
            options={SALES_CHANNELS}
          />
          {/* Étoile retirée ici */}
          <SelectOrOther
            label="Stade de développement"
            value={f.development_stage}
            onChange={(v) => setF({ ...f, development_stage: v })}
            options={DEV_STAGES}
          />
        </Section>

        <button
          onClick={submit}
          disabled={saving || !valid}
          className="w-full h-14 rounded-2xl bg-brand-terracotta text-white font-bold uppercase tracking-wider text-sm disabled:opacity-40"
        >
          {saving ? "…" : "Continuer"}
        </button>
        <p className="text-[11px] text-center text-brand-green/50">
          Les champs marqués * sont nécessaires pour vos statistiques.
        </p>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-green/60 mb-3">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
