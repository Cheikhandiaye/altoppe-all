
-- ============== POINTS OF SALE & SELLER ACCOUNTS ==============

-- 1) Table points_of_sale
CREATE TABLE public.points_of_sale (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pos_code_format CHECK (code ~ '^[A-Za-z0-9_-]{1,12}$'),
  CONSTRAINT pos_name_len CHECK (char_length(name) BETWEEN 1 AND 80),
  UNIQUE (owner_user_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.points_of_sale TO authenticated;
GRANT ALL ON public.points_of_sale TO service_role;

ALTER TABLE public.points_of_sale ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_pos_updated_at
BEFORE UPDATE ON public.points_of_sale
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Profiles: link sellers to their owner + active POS
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pos_id uuid REFERENCES public.points_of_sale(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role_in_pos text NOT NULL DEFAULT 'OWNER'
    CHECK (role_in_pos IN ('OWNER','SELLER'));

-- 3) Transactions: tag with POS
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS pos_id uuid REFERENCES public.points_of_sale(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_pos_id ON public.transactions(pos_id);

-- 4) Security definer helpers
CREATE OR REPLACE FUNCTION public.get_owner_id(_uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(owner_user_id, _uid)
  FROM public.profiles
  WHERE id = _uid
$$;

CREATE OR REPLACE FUNCTION public.get_my_pos_id(_uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pos_id FROM public.profiles WHERE id = _uid
$$;

CREATE OR REPLACE FUNCTION public.is_seller(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _uid AND role_in_pos = 'SELLER' AND owner_user_id IS NOT NULL
  )
$$;

-- 5) RLS on points_of_sale
CREATE POLICY "pos_owner_all" ON public.points_of_sale
  FOR ALL TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "pos_seller_select" ON public.points_of_sale
  FOR SELECT TO authenticated
  USING (owner_user_id = public.get_owner_id(auth.uid()));

CREATE POLICY "pos_coach_select" ON public.points_of_sale
  FOR SELECT TO authenticated
  USING (public.is_coach_of(auth.uid(), owner_user_id));

CREATE POLICY "pos_admin_all" ON public.points_of_sale
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 6) Extend RLS on transactions to allow seller scope
-- Sellers see/insert only transactions of their owner and tagged with their pos
DROP POLICY IF EXISTS txn_self_select ON public.transactions;
CREATE POLICY "txn_self_select" ON public.transactions
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (
      user_id = public.get_owner_id(auth.uid())
      AND public.is_seller(auth.uid())
      AND pos_id = public.get_my_pos_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS txn_self_insert ON public.transactions;
CREATE POLICY "txn_self_insert" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_id AND NOT public.is_seller(auth.uid()))
    OR (
      public.is_seller(auth.uid())
      AND user_id = public.get_owner_id(auth.uid())
      AND pos_id = public.get_my_pos_id(auth.uid())
    )
  );
-- Update/Delete remain owner-only via existing txn_self_update / txn_self_delete

-- 7) Extend RLS on activities so sellers can read their owner's activities
CREATE POLICY "activities_seller_select" ON public.activities
  FOR SELECT TO authenticated
  USING (
    public.is_seller(auth.uid())
    AND user_id = public.get_owner_id(auth.uid())
  );

-- 8) Extend RLS on contacts (carnets) so sellers can read/use owner's contacts
CREATE POLICY "contacts_seller_select" ON public.contacts
  FOR SELECT TO authenticated
  USING (
    public.is_seller(auth.uid())
    AND user_id = public.get_owner_id(auth.uid())
  );

-- 9) Profile: sellers can read their owner's profile (limited fields via app code)
CREATE POLICY "profiles_seller_select_owner" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.is_seller(auth.uid())
    AND id = public.get_owner_id(auth.uid())
  );

-- 10) Update handle_new_user to also create a default POS for new owners
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_activity_id uuid;
  new_pos_id uuid;
  is_seller_signup boolean;
BEGIN
  -- Sellers are created via the admin server fn which sets these in raw_user_meta_data
  is_seller_signup := COALESCE((NEW.raw_user_meta_data ->> 'role_in_pos') = 'SELLER', false);

  INSERT INTO public.profiles (id, full_name, phone, owner_user_id, pos_id, role_in_pos)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'phone',
    NULLIF(NEW.raw_user_meta_data ->> 'owner_user_id','')::uuid,
    NULLIF(NEW.raw_user_meta_data ->> 'pos_id','')::uuid,
    COALESCE(NEW.raw_user_meta_data ->> 'role_in_pos','OWNER')
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'entrepreneur');

  -- Only owners get a default activity + default POS
  IF NOT is_seller_signup THEN
    INSERT INTO public.activities (user_id, name, emoji)
    VALUES (NEW.id, 'Mon activité', '💼')
    RETURNING id INTO new_activity_id;

    INSERT INTO public.points_of_sale (owner_user_id, code, name)
    VALUES (NEW.id, 'P1', 'Point de vente principal')
    RETURNING id INTO new_pos_id;

    UPDATE public.profiles
       SET active_activity_id = new_activity_id
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 11) Backfill: create a default POS for every existing owner profile
INSERT INTO public.points_of_sale (owner_user_id, code, name)
SELECT p.id, 'P1', 'Point de vente principal'
FROM public.profiles p
WHERE p.owner_user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.points_of_sale x WHERE x.owner_user_id = p.id
  );

-- Attach existing transactions to that default POS
UPDATE public.transactions t
SET pos_id = pv.id
FROM public.points_of_sale pv
WHERE t.pos_id IS NULL
  AND pv.owner_user_id = t.user_id
  AND pv.code = 'P1';
