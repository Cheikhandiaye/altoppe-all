import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  adminApproveDraft,
  adminAssignCoach,
  adminBanUser,
  adminCreateUser,
  adminListAssignments,
  adminListDraftsAndErrors,
  adminListUsers,
  adminSetPassword,
  adminSetRole,
  adminUpdateProfile,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/parametrages")({
  component: ParametragesPage,
});

type SubTab = "moderation" | "assignations" | "users";

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " F";
}

function ParametragesPage() {
  const [tab, setTab] = useState<SubTab>("users");
  const tabs: { id: SubTab; label: string }[] = [
    { id: "users", label: "Utilisateurs" },
    { id: "assignations", label: "Assignations" },
    { id: "moderation", label: "Modération IA" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-1 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              tab === t.id
                ? "bg-brand-green text-white"
                : "bg-card border border-brand-green/10 text-brand-green/70 hover:text-brand-green"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersSection />}
      {tab === "assignations" && <AssignationsSection />}
      {tab === "moderation" && <ModerationSection />}
    </div>
  );
}

// ============= USERS =============

const LEGAL_STATUSES = ["Informel", "GIE", "Entreprise Individuelle", "SUARL", "SARL", "SA", "Autre"];
const SALES_CHANNELS = ["Boutique physique", "Réseaux sociaux", "Foires/Marchés", "Site e-commerce", "Bouche-à-oreille", "Autre"];
const DEV_STAGES = ["Idéation", "Démarrage", "En croissance", "Maturité"];
const SENEGAL_REGIONS = [
  "Dakar", "Thiès", "Saint-Louis", "Diourbel", "Louga", "Fatick", "Kaolack",
  "Kaffrine", "Tambacounda", "Kédougou", "Kolda", "Sédhiou", "Ziguinchor", "Matam",
  "Autre",
];
const SECTORS = [
  "Agriculture", "Agro-alimentaire", "Élevage", "Pêche", "Artisanat",
  "Commerce / Distribution", "Restauration", "Mode / Couture", "Beauté / Cosmétique",
  "Transport / Logistique", "BTP / Construction", "Éducation / Formation",
  "Santé / Bien-être", "Numérique / Tech", "Services aux entreprises",
  "Tourisme / Hôtellerie", "Énergie", "Communication / Médias", "Autre",
];
const PRIORITY_NEEDS = [
  "Financement",
  "Partenariats commerciaux",
  "Visibilité",
  "Formation",
  "Matériel / équipement",
  "Recrutement",
  "Conseil juridique",
];

function UsersSection() {
  const fetchUsers = useServerFn(adminListUsers);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => fetchUsers(),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pwdForId, setPwdForId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const list = data?.users ?? [];
    const q = search.toLowerCase().trim();
    if (!q) return list;
    return list.filter((u) =>
      [u.full_name, u.business_name, u.email, u.phone, u.region, u.sector]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [data, search]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });
  const editing = editingId ? (data?.users ?? []).find((u) => u.id === editingId) ?? null : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <input
          placeholder="Rechercher (nom, email, téléphone…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] bg-card border border-brand-green/10 rounded-lg px-3 py-2 text-sm"
        />
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-lg bg-brand-terracotta text-white text-sm font-semibold"
        >
          + Nouveau profil
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-brand-green/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brand-sand text-brand-green/70 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-2">Profil</th>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">Région / Secteur</th>
              <th className="text-left px-4 py-2">Rôles</th>
              <th className="text-left px-4 py-2">Statut</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-brand-green/60">
                  Chargement…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-brand-green/60">
                  Aucun utilisateur
                </td>
              </tr>
            ) : (
              filtered.map((u) => {
                const banned = !!u.banned_until && new Date(u.banned_until).getTime() > Date.now();
                return (
                  <tr key={u.id} className="border-t border-brand-green/5 align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-brand-green">
                        {u.business_name ?? u.full_name ?? "—"}
                      </p>
                      <p className="text-[10px] text-brand-green/50">
                        {u.full_name ?? ""} {u.phone ? `· ${u.phone}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-brand-green/80 text-xs">{u.email ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-brand-green/70">
                      <p>{u.region ?? "—"}</p>
                      <p className="text-brand-green/50">{u.sector ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <RoleToggles userId={u.id} roles={u.roles} onChange={refresh} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
                          banned
                            ? "bg-brand-terracotta text-white"
                            : "bg-success/10 text-success"
                        }`}
                      >
                        {banned ? "Suspendu" : "Actif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2 flex-wrap justify-end">
                        <button
                          onClick={() => setEditingId(u.id)}
                          className="text-[10px] font-bold uppercase tracking-wider text-brand-green hover:text-brand-terracotta"
                        >
                          Éditer
                        </button>
                        <button
                          onClick={() => setPwdForId(u.id)}
                          className="text-[10px] font-bold uppercase tracking-wider text-brand-green hover:text-brand-terracotta"
                        >
                          Mot de passe
                        </button>
                        <BanButton userId={u.id} banned={banned} onChange={refresh} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onCreated={refresh} />}
      {editing && (
        <EditProfileModal
          user={editing}
          onClose={() => setEditingId(null)}
          onSaved={refresh}
        />
      )}
      {pwdForId && (
        <SetPasswordModal userId={pwdForId} onClose={() => setPwdForId(null)} />
      )}
    </div>
  );
}

function RoleToggles({
  userId,
  roles,
  onChange,
}: {
  userId: string;
  roles: string[];
  onChange: () => void;
}) {
  const setRole = useServerFn(adminSetRole);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap gap-1">
      {(["entrepreneur", "coach", "admin"] as const).map((r) => {
        const has = roles.includes(r);
        return (
          <button
            key={r}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await setRole({
                  data: { userId, role: r, action: has ? "remove" : "add" },
                });
                onChange();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Erreur");
              } finally {
                setBusy(false);
              }
            }}
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
              has
                ? "bg-brand-green text-white"
                : "bg-brand-sand text-brand-green/40 hover:text-brand-green"
            }`}
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}

function BanButton({
  userId,
  banned,
  onChange,
}: {
  userId: string;
  banned: boolean;
  onChange: () => void;
}) {
  const ban = useServerFn(adminBanUser);
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        if (!confirm(banned ? "Réactiver ce compte ?" : "Suspendre ce compte ?")) return;
        setBusy(true);
        try {
          await ban({ data: { userId, banned: !banned } });
          toast.success(banned ? "Compte réactivé" : "Compte suspendu");
          onChange();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Erreur");
        } finally {
          setBusy(false);
        }
      }}
      className={`text-[10px] font-bold uppercase tracking-wider ${
        banned ? "text-success" : "text-brand-terracotta"
      } hover:underline`}
    >
      {banned ? "Réactiver" : "Suspendre"}
    </button>
  );
}

function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div
        className={`bg-card rounded-2xl ${wide ? "max-w-3xl" : "max-w-md"} w-full my-8 max-h-[90vh] overflow-y-auto`}
      >
        <div className="px-6 py-4 border-b border-brand-green/10 flex items-center justify-between sticky top-0 bg-card">
          <h3 className="font-display text-lg font-bold text-brand-green">{title}</h3>
          <button
            onClick={onClose}
            className="text-brand-green/60 hover:text-brand-terracotta text-2xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const create = useServerFn(adminCreateUser);
  const [mode, setMode] = useState<"direct" | "invite">("direct");
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    business_name: "",
    region: "",
    sector: "",
    role: "entrepreneur" as "entrepreneur" | "coach" | "admin",
  });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await create({
        data: {
          ...form,
          mode,
          password: mode === "direct" ? form.password : undefined,
          full_name: form.full_name || undefined,
          phone: form.phone || undefined,
          business_name: form.business_name || undefined,
          region: form.region || undefined,
          sector: form.sector || undefined,
        },
      });
      toast.success(mode === "direct" ? "Compte créé" : "Invitation envoyée");
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Nouveau profil utilisateur" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex gap-1">
          {(["direct", "invite"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 text-xs font-bold uppercase tracking-wider px-3 py-2 rounded ${
                mode === m
                  ? "bg-brand-green text-white"
                  : "bg-brand-sand text-brand-green/60"
              }`}
            >
              {m === "direct" ? "Création directe" : "Invitation email"}
            </button>
          ))}
        </div>
        <Input label="Email *" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        {mode === "direct" && (
          <Input
            label="Mot de passe temporaire *"
            type="text"
            value={form.password}
            onChange={(v) => setForm({ ...form, password: v })}
          />
        )}
        <Input label="Nom complet" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
        <Input label="Téléphone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Input label="Nom entreprise / GIE" value={form.business_name} onChange={(v) => setForm({ ...form, business_name: v })} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SelectOrOther label="Région" value={form.region} onChange={(v) => setForm({ ...form, region: v })} options={SENEGAL_REGIONS} />
          <SelectOrOther label="Secteur d'activité" value={form.sector} onChange={(v) => setForm({ ...form, sector: v })} options={SECTORS} />
        </div>
        <Field label="Rôle initial">
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}
            className="w-full bg-brand-sand rounded-lg px-3 py-2 text-sm"
          >
            <option value="entrepreneur">Entrepreneur</option>
            <option value="coach">Coach</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <button
          disabled={busy || !form.email || (mode === "direct" && !form.password)}
          onClick={submit}
          className="w-full mt-3 px-4 py-2 rounded-lg bg-brand-terracotta text-white text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "…" : mode === "direct" ? "Créer le compte" : "Envoyer l'invitation"}
        </button>
      </div>
    </Modal>
  );
}

type EditableUser = Awaited<ReturnType<typeof adminListUsers>>["users"][number];

function EditProfileModal({
  user,
  onClose,
  onSaved,
}: {
  user: EditableUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const update = useServerFn(adminUpdateProfile);
  const [busy, setBusy] = useState(false);
  const [p, setP] = useState({
    full_name: user.full_name ?? "",
    phone: user.phone ?? "",
    business_name: user.business_name ?? "",
    region: user.region ?? "",
    sector: user.sector ?? "",
    legal_status: user.legal_status ?? "",
    ninea: user.ninea ?? "",
    rccm: user.rccm ?? "",
    founding_year: user.founding_year ?? ("" as number | ""),
    team_size: user.team_size ?? ("" as number | ""),
    avatar_url: user.avatar_url ?? "",
    activity_description: user.activity_description ?? "",
    sales_channel: user.sales_channel ?? "",
    whatsapp_link: user.whatsapp_link ?? "",
    development_stage: user.development_stage ?? "",
    priority_needs: (user.priority_needs ?? []) as string[],
    annual_revenue: user.annual_revenue ?? ("" as number | ""),
    annual_expenses: user.annual_expenses ?? ("" as number | ""),
  });

  const submit = async () => {
    setBusy(true);
    try {
      await update({
        data: {
          userId: user.id,
          patch: {
            full_name: p.full_name || null,
            phone: p.phone || null,
            business_name: p.business_name || null,
            region: p.region || null,
            sector: p.sector || null,
            legal_status: p.legal_status || null,
            ninea: p.ninea || null,
            rccm: p.rccm || null,
            founding_year: p.founding_year === "" ? null : Number(p.founding_year),
            team_size: p.team_size === "" ? null : Number(p.team_size),
            avatar_url: p.avatar_url || null,
            activity_description: p.activity_description || null,
            sales_channel: p.sales_channel || null,
            whatsapp_link: p.whatsapp_link || null,
            development_stage: p.development_stage || null,
            priority_needs: p.priority_needs.length > 0 ? p.priority_needs : null,
            annual_revenue: p.annual_revenue === "" ? null : Number(p.annual_revenue),
            annual_expenses: p.annual_expenses === "" ? null : Number(p.annual_expenses),
          },
        },
      });
      toast.success("Profil mis à jour");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const toggleNeed = (n: string) => {
    setP({
      ...p,
      priority_needs: p.priority_needs.includes(n)
        ? p.priority_needs.filter((x) => x !== n)
        : [...p.priority_needs, n],
    });
  };

  return (
    <Modal title={`Profil — ${user.business_name ?? user.full_name ?? user.email ?? ""}`} onClose={onClose} wide>
      <div className="space-y-5">
        <Section title="Identité de l'entreprise">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Nom du dirigeant" value={p.full_name} onChange={(v) => setP({ ...p, full_name: v })} />
            <Input label="Téléphone" value={p.phone} onChange={(v) => setP({ ...p, phone: v })} />
            <Input label="Nom entreprise / GIE" value={p.business_name} onChange={(v) => setP({ ...p, business_name: v })} />
            <Select
              label="Statut juridique"
              value={p.legal_status}
              onChange={(v) => setP({ ...p, legal_status: v })}
              options={LEGAL_STATUSES}
            />
            <Input label="NINEA (optionnel)" value={p.ninea} onChange={(v) => setP({ ...p, ninea: v })} />
            <Input label="RCCM (optionnel)" value={p.rccm} onChange={(v) => setP({ ...p, rccm: v })} />
            <Input
              label="Année de création"
              type="number"
              value={String(p.founding_year)}
              onChange={(v) => setP({ ...p, founding_year: v === "" ? "" : Number(v) })}
            />
            <Input
              label="Taille de l'équipe"
              type="number"
              value={String(p.team_size)}
              onChange={(v) => setP({ ...p, team_size: v === "" ? "" : Number(v) })}
            />
            <SelectOrOther label="Région" value={p.region} onChange={(v) => setP({ ...p, region: v })} options={SENEGAL_REGIONS} />
            <SelectOrOther label="Secteur d'activité" value={p.sector} onChange={(v) => setP({ ...p, sector: v })} options={SECTORS} />
          </div>
        </Section>

        <Section title="Visibilité et ventes">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <PhotoUploader userId={user.id} value={p.avatar_url} onChange={(v) => setP({ ...p, avatar_url: v })} />
            <Select
              label="Canal de vente principal"
              value={p.sales_channel}
              onChange={(v) => setP({ ...p, sales_channel: v })}
              options={SALES_CHANNELS}
            />
            <Input label="Lien WhatsApp Business" value={p.whatsapp_link} onChange={(v) => setP({ ...p, whatsapp_link: v })} />
          </div>
          <Field label="Description courte de l'activité">
            <textarea
              rows={3}
              value={p.activity_description}
              onChange={(e) => setP({ ...p, activity_description: e.target.value })}
              className="w-full bg-brand-sand rounded-lg px-3 py-2 text-sm"
              placeholder="Produits ou services clés…"
            />
          </Field>
        </Section>

        <Section title="Développement et opportunités">
          <Select
            label="Stade de développement"
            value={p.development_stage}
            onChange={(v) => setP({ ...p, development_stage: v })}
            options={DEV_STAGES}
          />
          <Field label="Besoins prioritaires (multi-sélection)">
            <div className="flex flex-wrap gap-2">
              {PRIORITY_NEEDS.map((n) => {
                const sel = p.priority_needs.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleNeed(n)}
                    className={`text-xs px-3 py-1.5 rounded-full ${
                      sel
                        ? "bg-brand-green text-white"
                        : "bg-brand-sand text-brand-green/70"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </Field>
        </Section>

        <Section title="Données financières annuelles (estimatives)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Chiffre d'affaires annuel (FCFA)"
              type="number"
              value={String(p.annual_revenue)}
              onChange={(v) => setP({ ...p, annual_revenue: v === "" ? "" : Number(v) })}
            />
            <Input
              label="Charges annuelles (FCFA)"
              type="number"
              value={String(p.annual_expenses)}
              onChange={(v) => setP({ ...p, annual_expenses: v === "" ? "" : Number(v) })}
            />
          </div>
          {(p.annual_revenue !== "" || p.annual_expenses !== "") && (
            <p className="text-xs text-brand-green/60 mt-2">
              Estimation solde :{" "}
              <span className="font-display font-bold text-brand-green">
                {formatXOF((Number(p.annual_revenue) || 0) - (Number(p.annual_expenses) || 0))}
              </span>
            </p>
          )}
        </Section>

        <button
          disabled={busy}
          onClick={submit}
          className="w-full px-4 py-3 rounded-lg bg-brand-terracotta text-white text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "Enregistrement…" : "Enregistrer le profil"}
        </button>
      </div>
    </Modal>
  );
}

function SetPasswordModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const setPwd = useServerFn(adminSetPassword);
  const [pwd, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Modifier le mot de passe" onClose={onClose}>
      <div className="space-y-3">
        <Input label="Nouveau mot de passe (min. 8 caractères)" type="text" value={pwd} onChange={setPwd2} />
        <button
          disabled={busy || pwd.length < 8}
          onClick={async () => {
            setBusy(true);
            try {
              await setPwd({ data: { userId, password: pwd } });
              toast.success("Mot de passe modifié");
              onClose();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Erreur");
            } finally {
              setBusy(false);
            }
          }}
          className="w-full px-4 py-2 rounded-lg bg-brand-terracotta text-white text-sm font-semibold disabled:opacity-50"
        >
          Modifier
        </button>
      </div>
    </Modal>
  );
}

// ============= ASSIGNATIONS =============

function AssignationsSection() {
  const fetchUsers = useServerFn(adminListUsers);
  const fetchAssign = useServerFn(adminListAssignments);
  const assignCoach = useServerFn(adminAssignCoach);
  const qc = useQueryClient();

  const { data: usersData } = useQuery({ queryKey: ["admin", "users"], queryFn: () => fetchUsers() });
  const { data: assignData } = useQuery({
    queryKey: ["admin", "assignments"],
    queryFn: () => fetchAssign(),
  });

  const coaches = useMemo(
    () => (usersData?.users ?? []).filter((u) => u.roles.includes("coach")),
    [usersData],
  );
  const entrepreneurs = useMemo(
    () =>
      (usersData?.users ?? []).filter(
        (u) => u.roles.includes("entrepreneur") || u.roles.length === 0,
      ),
    [usersData],
  );

  const [coachId, setCoachId] = useState("");
  const [entId, setEntId] = useState("");
  const [busy, setBusy] = useState(false);

  const userName = (id: string) =>
    (usersData?.users ?? []).find((u) => u.id === id)?.business_name ??
    (usersData?.users ?? []).find((u) => u.id === id)?.full_name ??
    id.slice(0, 8);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "assignments"] });

  return (
    <div className="bg-card rounded-2xl border border-brand-green/10 p-5">
      <h2 className="font-display text-lg font-bold text-brand-green mb-4">
        Assignations coach ↔ entrepreneur
      </h2>
      <div className="flex flex-wrap gap-2 mb-5 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] font-bold uppercase tracking-widest text-brand-green/60 block mb-1">
            Coach
          </label>
          <select
            value={coachId}
            onChange={(e) => setCoachId(e.target.value)}
            className="w-full bg-brand-sand rounded-lg px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name ?? c.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] font-bold uppercase tracking-widest text-brand-green/60 block mb-1">
            Entrepreneur
          </label>
          <select
            value={entId}
            onChange={(e) => setEntId(e.target.value)}
            className="w-full bg-brand-sand rounded-lg px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {entrepreneurs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.business_name ?? c.full_name ?? c.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        <button
          disabled={busy || !coachId || !entId}
          onClick={async () => {
            setBusy(true);
            try {
              await assignCoach({ data: { coachId, entrepreneurId: entId, action: "add" } });
              await refresh();
              toast.success("Entrepreneur assigné");
              setEntId("");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Erreur");
            } finally {
              setBusy(false);
            }
          }}
          className="h-10 px-4 rounded-lg bg-brand-terracotta text-white text-sm font-semibold disabled:opacity-50"
        >
          Assigner
        </button>
      </div>

      {(assignData?.assignments ?? []).length === 0 ? (
        <p className="text-sm text-brand-green/60">Aucune assignation pour le moment.</p>
      ) : (
        <ul className="divide-y divide-brand-green/10">
          {(assignData?.assignments ?? []).map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className="font-semibold text-brand-green">{userName(a.coach_id)}</span>
                <span className="text-brand-green/40 mx-2">→</span>
                <span>{userName(a.entrepreneur_id)}</span>
              </span>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await assignCoach({
                      data: {
                        coachId: a.coach_id,
                        entrepreneurId: a.entrepreneur_id,
                        action: "remove",
                      },
                    });
                    await refresh();
                    toast.success("Désassigné");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Erreur");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="text-xs text-brand-terracotta hover:underline"
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============= MODERATION =============

function ModerationSection() {
  const fetchUsers = useServerFn(adminListUsers);
  const fetchMod = useServerFn(adminListDraftsAndErrors);
  const approveDraft = useServerFn(adminApproveDraft);
  const qc = useQueryClient();

  const { data: usersData } = useQuery({ queryKey: ["admin", "users"], queryFn: () => fetchUsers() });
  const { data: mod } = useQuery({
    queryKey: ["admin", "moderation"],
    queryFn: () => fetchMod(),
  });

  const [busy, setBusy] = useState(false);
  const userName = (id: string) =>
    (usersData?.users ?? []).find((u) => u.id === id)?.business_name ??
    (usersData?.users ?? []).find((u) => u.id === id)?.full_name ??
    id.slice(0, 8);

  return (
    <section className="bg-card rounded-2xl border border-brand-green/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-bold text-brand-green">
          Modération IA — Brouillons & erreurs
        </h2>
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand-green/50">
          {(mod?.drafts ?? []).length} brouillons · {(mod?.errors ?? []).length} erreurs
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-terracotta mb-2">
            Brouillons à valider
          </h3>
          {(mod?.drafts ?? []).length === 0 ? (
            <p className="text-xs text-brand-green/60">Aucun brouillon.</p>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {(mod?.drafts ?? []).map((d) => (
                <li key={d.id} className="bg-brand-sand rounded-lg p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-brand-green">{userName(d.user_id)}</span>
                    <span
                      className={`font-display font-bold ${
                        d.type === "IN" ? "text-success" : "text-brand-terracotta"
                      }`}
                    >
                      {d.type === "IN" ? "+" : "−"}
                      {formatXOF(Number(d.amount))}
                    </span>
                  </div>
                  <p className="text-brand-green/70">
                    {d.label || d.category || "—"} · {d.source}
                  </p>
                  {d.transcript && (
                    <p className="italic text-brand-green/60 line-clamp-2">« {d.transcript} »</p>
                  )}
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await approveDraft({ data: { id: d.id } });
                        await qc.invalidateQueries({ queryKey: ["admin", "moderation"] });
                        toast.success("Brouillon validé");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Erreur");
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="mt-1 text-[10px] font-bold uppercase tracking-wider text-brand-terracotta hover:underline"
                  >
                    Approuver →
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-brand-terracotta mb-2">
            Erreurs IA
          </h3>
          {(mod?.errors ?? []).length === 0 ? (
            <p className="text-xs text-brand-green/60">Aucune erreur récente.</p>
          ) : (
            <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {(mod?.errors ?? []).map((e) => (
                <li key={e.id} className="bg-brand-sand rounded-lg p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-brand-green">{userName(e.user_id)}</span>
                    <span className="text-[10px] text-brand-green/50">{e.source}</span>
                  </div>
                  <p className="text-brand-terracotta font-semibold">{e.error_message}</p>
                  {e.transcript && (
                    <p className="italic text-brand-green/60 line-clamp-2">« {e.transcript} »</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// ============= Petits composants UI =============

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest text-brand-green/60 block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <Field label={label}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-brand-sand rounded-lg px-3 py-2 text-sm"
      />
    </Field>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-brand-sand rounded-lg px-3 py-2 text-sm"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}

function SelectOrOther({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const isPreset = !value || options.includes(value);
  const [mode, setMode] = useState<"preset" | "other">(isPreset ? "preset" : "other");
  return (
    <Field label={label}>
      <select
        value={mode === "other" ? "Autre" : value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "Autre") {
            setMode("other");
            onChange("");
          } else {
            setMode("preset");
            onChange(v);
          }
        }}
        className="w-full bg-brand-sand rounded-lg px-3 py-2 text-sm"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {mode === "other" && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Préciser…"
          className="mt-2 w-full bg-brand-sand rounded-lg px-3 py-2 text-sm"
        />
      )}
    </Field>
  );
}

function PhotoUploader({
  userId,
  value,
  onChange,
}: {
  userId: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 5 Mo)");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Photo importée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field label="Photo / logo">
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-brand-sand overflow-hidden flex items-center justify-center border border-brand-green/10 shrink-0">
          {value ? (
            <img src={value} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] text-brand-green/40">Aucune</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => galleryRef.current?.click()}
            className="text-xs font-bold uppercase tracking-wider px-3 py-2 rounded bg-brand-green text-white disabled:opacity-50"
          >
            {busy ? "…" : "Galerie"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
            className="text-xs font-bold uppercase tracking-wider px-3 py-2 rounded bg-brand-terracotta text-white disabled:opacity-50"
          >
            Caméra
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-xs font-bold uppercase tracking-wider px-3 py-2 rounded bg-brand-sand text-brand-green/70"
            >
              Retirer
            </button>
          )}
        </div>
      </div>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
    </Field>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-green/60 mb-2">
        {title}
      </h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
