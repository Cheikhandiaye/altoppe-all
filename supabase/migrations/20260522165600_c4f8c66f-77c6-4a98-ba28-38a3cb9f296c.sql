-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('entrepreneur', 'coach', 'admin');
CREATE TYPE public.txn_type AS ENUM ('IN', 'OUT');
CREATE TYPE public.txn_source AS ENUM ('MANUEL', 'TEXT', 'VOICE');
CREATE TYPE public.txn_validation AS ENUM ('VALIDE', 'A_VALIDER');

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  region TEXT,
  sector TEXT,
  business_name TEXT,
  pin_hash TEXT,
  pin_salt TEXT,
  language TEXT NOT NULL DEFAULT 'fr',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ========== USER ROLES ==========
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ========== has_role() SECURITY DEFINER ==========
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ========== COACH ASSIGNMENTS ==========
CREATE TABLE public.coach_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entrepreneur_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_id, entrepreneur_id)
);
ALTER TABLE public.coach_assignments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_coach_of(_coach_id UUID, _entrepreneur_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_assignments
    WHERE coach_id = _coach_id AND entrepreneur_id = _entrepreneur_id
  )
$$;

-- ========== TRANSACTIONS ==========
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  type public.txn_type NOT NULL,
  nature TEXT,
  category TEXT,
  label TEXT,
  third_party TEXT,
  source public.txn_source NOT NULL DEFAULT 'MANUEL',
  is_personal BOOLEAN NOT NULL DEFAULT FALSE,
  validation_status public.txn_validation NOT NULL DEFAULT 'VALIDE',
  external_id TEXT UNIQUE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_txn_user_occurred ON public.transactions (user_id, occurred_at DESC);
CREATE INDEX idx_txn_user_status ON public.transactions (user_id, validation_status);

-- ========== AUDIT LOG ==========
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  before JSONB,
  after JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ========== updated_at TRIGGER ==========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_txn_updated BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== AUTO-CREATE PROFILE + ROLE ON SIGNUP ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'phone'
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'entrepreneur');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== RLS POLICIES — profiles ==========
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_coach_select" ON public.profiles
  FOR SELECT USING (public.is_coach_of(auth.uid(), id));
CREATE POLICY "profiles_admin_select" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- ========== RLS POLICIES — user_roles ==========
CREATE POLICY "roles_self_select" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "roles_admin_all" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========== RLS POLICIES — coach_assignments ==========
CREATE POLICY "assign_coach_select" ON public.coach_assignments
  FOR SELECT USING (auth.uid() = coach_id);
CREATE POLICY "assign_entrepreneur_select" ON public.coach_assignments
  FOR SELECT USING (auth.uid() = entrepreneur_id);
CREATE POLICY "assign_admin_all" ON public.coach_assignments
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========== RLS POLICIES — transactions ==========
CREATE POLICY "txn_self_select" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "txn_self_insert" ON public.transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "txn_self_update" ON public.transactions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "txn_self_delete" ON public.transactions
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "txn_coach_select" ON public.transactions
  FOR SELECT USING (public.is_coach_of(auth.uid(), user_id));
CREATE POLICY "txn_coach_update" ON public.transactions
  FOR UPDATE USING (public.is_coach_of(auth.uid(), user_id));

CREATE POLICY "txn_admin_all" ON public.transactions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========== RLS POLICIES — audit_log ==========
CREATE POLICY "audit_self_insert" ON public.audit_log
  FOR INSERT WITH CHECK (auth.uid() = actor_id);
CREATE POLICY "audit_self_select" ON public.audit_log
  FOR SELECT USING (auth.uid() = actor_id);
CREATE POLICY "audit_admin_select" ON public.audit_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));