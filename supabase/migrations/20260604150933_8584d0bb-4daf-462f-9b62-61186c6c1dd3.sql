
-- 1. Table activities
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_user ON public.activities(user_id) WHERE is_archived = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activities_self_all" ON public.activities
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "activities_coach_select" ON public.activities
  FOR SELECT TO authenticated
  USING (public.is_coach_of(auth.uid(), user_id));
CREATE POLICY "activities_admin_all" ON public.activities
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_activities_updated BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Add activity_id to transactions and contacts
ALTER TABLE public.transactions ADD COLUMN activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL;
ALTER TABLE public.contacts ADD COLUMN activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL;

CREATE INDEX idx_txn_activity ON public.transactions(user_id, activity_id, occurred_at DESC);
CREATE INDEX idx_contacts_activity ON public.contacts(user_id, activity_id, type);

-- 3. Add active_activity_id to profiles
ALTER TABLE public.profiles ADD COLUMN active_activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL;

-- 4. Backfill: create a default activity for each user that has any data, link existing rows
DO $$
DECLARE
  u record;
  new_id uuid;
BEGIN
  FOR u IN
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM public.transactions
      UNION
      SELECT user_id FROM public.contacts
      UNION
      SELECT id AS user_id FROM public.profiles
    ) s
  LOOP
    INSERT INTO public.activities (user_id, name, emoji)
    VALUES (u.user_id, 'Mon activité', '💼')
    RETURNING id INTO new_id;

    UPDATE public.transactions SET activity_id = new_id WHERE user_id = u.user_id AND activity_id IS NULL;
    UPDATE public.contacts SET activity_id = new_id WHERE user_id = u.user_id AND activity_id IS NULL;
    UPDATE public.profiles SET active_activity_id = new_id WHERE id = u.user_id AND active_activity_id IS NULL;
  END LOOP;
END $$;

-- 5. Update handle_new_user trigger to also create a default activity
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_activity_id uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'phone'
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'entrepreneur');
  INSERT INTO public.activities (user_id, name, emoji)
  VALUES (NEW.id, 'Mon activité', '💼')
  RETURNING id INTO new_activity_id;
  UPDATE public.profiles SET active_activity_id = new_activity_id WHERE id = NEW.id;
  RETURN NEW;
END;
$function$;
