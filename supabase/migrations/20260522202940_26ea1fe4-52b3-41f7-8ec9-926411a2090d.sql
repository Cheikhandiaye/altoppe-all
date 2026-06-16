
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS legal_status text,
  ADD COLUMN IF NOT EXISTS ninea text,
  ADD COLUMN IF NOT EXISTS rccm text,
  ADD COLUMN IF NOT EXISTS founding_year integer,
  ADD COLUMN IF NOT EXISTS team_size integer,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS activity_description text,
  ADD COLUMN IF NOT EXISTS sales_channel text,
  ADD COLUMN IF NOT EXISTS whatsapp_link text,
  ADD COLUMN IF NOT EXISTS development_stage text,
  ADD COLUMN IF NOT EXISTS priority_needs text[],
  ADD COLUMN IF NOT EXISTS annual_revenue numeric,
  ADD COLUMN IF NOT EXISTS annual_expenses numeric,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Allow admins to update any profile (already have admin select; add update)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_admin_update_all'
  ) THEN
    CREATE POLICY profiles_admin_update_all ON public.profiles
      FOR UPDATE USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Allow admin to insert profiles (used when creating users)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_admin_insert'
  ) THEN
    CREATE POLICY profiles_admin_insert ON public.profiles
      FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
