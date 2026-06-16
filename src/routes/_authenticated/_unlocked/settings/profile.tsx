import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getMyProfile, updateMyProfile } from "@/lib/settings.functions";
import {
  LEGAL_STATUSES, SALES_CHANNELS, DEV_STAGES, SENEGAL_REGIONS, SECTORS, PRIORITY_NEEDS,
} from "@/lib/profile-constants";
import { Field, TextInput, TextArea, SelectOrOther, PhotoUploader } from "@/components/profile/Field";

export const Route = createFileRoute("/_authenticated/_unlocked/settings/profile")({
  component: ProfilePage,
});

type Form = {
  full_name: string; business_name: string; phone: string; whatsapp_link: string;
  region: string; sector: string; legal_status: string; ninea: string; rccm: string;
  founding_year: string; team_size: string; avatar_url: string;
  activity_description: string; sales_channel: string; development_stage: string;
  priority_needs: string[]; annual_revenue: string; annual_expenses: string;
};

const EMPTY: Form = {
  full_name: "", business_name: "", phone: "", whatsapp_link: "",
  region: "", sector: "", legal_status: "", ninea: "", rccm: "",
  founding_year: "", team_size: "", avatar_url: "",
  activity_description: "", sales_channel: "", development_stage: "",
  priority_needs: [], annual_revenue: "", annual_expenses: "",
};

function ProfilePage() {
  const { user } = useAuth();
  const fetchProfile = useServerFn(getMyProfile);
  const callUpdate = useServerFn(updateMyProfile);
  const { data, refetch } = useQuery({ queryKey: ["my-profile"], queryFn: () => fetchProfile() });
  const [f, setF] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data?.profile) return;
    const p = data.profile;
    setF({
      full_name: p.full_name ?? "",
      business_name: p.business_name ?? "",
      phone: p.phone ?? "",
      whatsapp_link: p.whatsapp_link ?? "",
      region: p.region ?? "",
      sector: p.sector ?? "",
      legal_status: p.legal_status ?? "",
      ninea: p.ninea ?? "",
      rccm: p.rccm ?? "",
      founding_year: p.founding_year ? String(p.founding_year) : "",
      team_size: p.team_size != null ? String(p.team_size) : "",
      avatar_url: p.avatar_url ?? "",
      activity_description: p.activity_description ?? "",
      sales_channel: p.sales_channel ?? "",
      development_stage: p.development_stage ?? "",
      priority_needs: Array.isArray(p.priority_needs) ? p.priority_needs as string[] : [],
      annual_revenue: p.annual_revenue != null ? String(p.annual_revenue) : "",
      annual_expenses: p.annual_expenses != null ? String(p.annual_expenses) : "",
    });
  }, [data]);

  const togglePN = (n: string) => {
    setF((cur) => ({
      ...cur,
      priority_needs: cur.priority_needs.includes(n)
        ? cur.priority_needs.filter((x) => x !== n)
        : [...cur.priority_needs, n],
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await callUpdate({
        data: {
          full_name: f.full_name || null,
          business_name: f.business_name || null,
          phone: f.phone || null,
          whatsapp_link: f.whatsapp_link || null,
          region: f.region || null,
          sector: f.sector || null,
          legal_status: f.legal_status || null,
          ninea: f.ninea || null,
          rccm: f.rccm || null,
          founding_year: f.founding_year ? parseInt(f.founding_year, 10) : null,
          team_size: f.team_size ? parseInt(f.team_size, 10) : null,
          avatar_url: f.avatar_url || null,
          activity_description: f.activity_description || null,
          sales_channel: f.sales_channel || null,
          development_stage: f.development_stage || null,
          priority_needs: f.priority_needs.length ? f.priority_needs : null,
          annual_revenue: f.annual_revenue ? Number(f.annual_revenue) : null,
          annual_expenses: f.annual_expenses ? Number(f.annual_expenses) : null,
        },
      });
      toast.success("Profil enregistré");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 pb-6">
      <Section title="Identité">
        {user && <PhotoUploader userId={user.id} value={f.avatar_url} onChange={(v) => setF({ ...f, avatar_url: v })} />}
        <Field label="Nom complet"><TextInput value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
        <Field label="Téléphone"><TextInput value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Lien WhatsApp"><TextInput value={f.whatsapp_link} onChange={(e) => setF({ ...f, whatsapp_link: e.target.value })} placeholder="https://wa.me/221..." /></Field>
      </Section>

      <Section title="Entreprise">
        <Field label="Nom de l'entreprise / GIE"><TextInput value={f.business_name} onChange={(e) => setF({ ...f, business_name: e.target.value })} /></Field>
        <SelectOrOther label="Statut juridique" value={f.legal_status} onChange={(v) => setF({ ...f, legal_status: v })} options={LEGAL_STATUSES} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="NINEA (optionnel)"><TextInput value={f.ninea} onChange={(e) => setF({ ...f, ninea: e.target.value })} /></Field>
          <Field label="RCCM (optionnel)"><TextInput value={f.rccm} onChange={(e) => setF({ ...f, rccm: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Année de création"><TextInput type="number" value={f.founding_year} onChange={(e) => setF({ ...f, founding_year: e.target.value })} /></Field>
          <Field label="Taille de l'équipe"><TextInput type="number" value={f.team_size} onChange={(e) => setF({ ...f, team_size: e.target.value })} /></Field>
        </div>
      </Section>

      <Section title="Activité">
        <SelectOrOther label="Région" value={f.region} onChange={(v) => setF({ ...f, region: v })} options={SENEGAL_REGIONS} />
        <SelectOrOther label="Secteur d'activité" value={f.sector} onChange={(v) => setF({ ...f, sector: v })} options={SECTORS} />
        <Field label="Description de l'activité"><TextArea rows={3} value={f.activity_description} onChange={(e) => setF({ ...f, activity_description: e.target.value })} /></Field>
        <SelectOrOther label="Canal de vente principal" value={f.sales_channel} onChange={(v) => setF({ ...f, sales_channel: v })} options={SALES_CHANNELS} />
        <SelectOrOther label="Stade de développement" value={f.development_stage} onChange={(v) => setF({ ...f, development_stage: v })} options={DEV_STAGES} />
      </Section>

      <Section title="Besoins prioritaires">
        <div className="flex flex-wrap gap-2">
          {PRIORITY_NEEDS.map((n) => {
            const on = f.priority_needs.includes(n);
            return (
              <button
                key={n}
                type="button"
                onClick={() => togglePN(n)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  on ? "bg-brand-green text-white border-brand-green" : "bg-card text-brand-green/70 border-brand-green/20"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Indicateurs annuels (estimés)">
        <div className="grid grid-cols-2 gap-3">
          <Field label="CA annuel (F)"><TextInput type="number" value={f.annual_revenue} onChange={(e) => setF({ ...f, annual_revenue: e.target.value })} /></Field>
          <Field label="Charges annuelles (F)"><TextInput type="number" value={f.annual_expenses} onChange={(e) => setF({ ...f, annual_expenses: e.target.value })} /></Field>
        </div>
      </Section>

      <button
        onClick={save}
        disabled={saving}
        className="w-full h-12 rounded-xl bg-brand-terracotta text-white font-bold uppercase tracking-wider text-sm disabled:opacity-50"
      >
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>
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
