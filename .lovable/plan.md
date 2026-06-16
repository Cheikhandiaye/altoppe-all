## Objectif
Forcer les nouveaux utilisateurs à compléter leur profil (champs essentiels obligatoires) puis à parcourir un tutoriel visuel en 4 écrans avant d'accéder à l'app.

## Champs profil obligatoires (utiles aux stats)
- `full_name` (identité)
- `business_name` (entreprise)
- `phone`
- `region` (Sénégal)
- `sector` (secteur d'activité)
- `legal_status`
- `development_stage` (stade — utile au coaching/stats)
- `sales_channel` (canal de vente principal)

Optionnels (laissés tels quels) : NINEA, RCCM, année, équipe, description, besoins, CA/charges, avatar, WhatsApp.

## Suivi de complétion
Nouveau champ DB `profiles.onboarding_completed_at timestamptz null`.
- Mis à `now()` une fois le profil + tuto terminés (ou tuto skippé).
- Sert de drapeau pour la redirection.

## Flux

```
Signup ──► /onboarding/profile ──► /onboarding/tour?step=1..4 ──► /app
                  (obligatoire)          (Suivant / Sortir)
```

Garde dans `_authenticated/_unlocked` :
- Si `onboarding_completed_at` est null ET role = OWNER ET route ≠ `/onboarding/*` → redirect vers `/onboarding/profile`.
- Les SELLER sont exemptés (créés par leur owner).

## Écrans à créer

**1. `/onboarding/profile`** — Formulaire condensé, plein écran (sans bottom nav), réutilise les composants `Field/TextInput/SelectOrOther` existants. Validation Zod côté server-fn pour exiger les 8 champs. Bouton "Continuer" désactivé tant qu'incomplet.

**2. `/onboarding/tour`** — Carrousel 4 étapes, search param `?step=1..4`. Chaque étape :
- Grand visuel illustratif (icône lucide grand format + dégradé brand, ou capture stylisée du module)
- Titre court (1 ligne)
- 1 phrase max
- Footer fixe : bouton "Sortir" (gauche, ghost) + "Suivant" (droite, brand-terracotta). Étape 4 : "Commencer".
- Indicateur de progression (4 points).

Contenu des 4 étapes (peu de texte, visuel dominant) :
1. **Saisie vocale** — Mic animé, "Parlez, on note tout"
2. **Tableau de bord** — Graphique stylisé, "Vos revenus en un clin d'œil"
3. **Transactions & catégories** — Liste illustrée, "Tout est rangé pour vous"
4. **Coach & conseils** — Bulle de chat, "Un coach vous accompagne"

"Sortir" et "Commencer" appellent un server-fn `completeOnboarding()` qui set `onboarding_completed_at = now()` puis redirige `/app`.

## Modifications techniques

### Migration
- `ALTER TABLE profiles ADD COLUMN onboarding_completed_at timestamptz`
- Pour les comptes existants : `UPDATE profiles SET onboarding_completed_at = now() WHERE id IN (SELECT id FROM profiles)` (pour ne pas forcer les anciens users à refaire).

### Backend (`src/lib/settings.functions.ts` + nouveau `onboarding.functions.ts`)
- `getMyProfile` retourne déjà tout — ajouter `onboarding_completed_at` au type.
- Nouveau `completeOnboardingProfile` : valide les 8 champs requis via Zod, update profil.
- Nouveau `completeOnboarding` : set `onboarding_completed_at = now()`.

### Routes
- `src/routes/_authenticated/_unlocked/onboarding/profile.tsx`
- `src/routes/_authenticated/_unlocked/onboarding/tour.tsx`
- Garde dans `src/routes/_authenticated/_unlocked.tsx` : redirect vers `/onboarding/profile` si non complété (OWNER uniquement, hors routes onboarding).

### UI
- Layout `onboarding` sans BottomBar (rendu conditionnel dans `_unlocked.tsx` si route commence par `/onboarding`).
- Visuels du tour : icônes lucide existantes (Mic, BarChart3, ListChecks, MessageCircle) dans un cercle dégradé `bg-brand-green/bg-brand-terracotta`, plus formes décoratives.

## Hors-scope
- Pas de modifications signup/login.
- Pas de changements pour SELLER/admin/coach.
- Les corrections de sécurité RLS visibles dans le scan ne sont pas traitées ici.
