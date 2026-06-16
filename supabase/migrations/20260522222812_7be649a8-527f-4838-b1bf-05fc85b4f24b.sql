
CREATE TYPE public.contact_type AS ENUM ('CLIENT', 'FOURNISSEUR');

CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type public.contact_type NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, type, name)
);

CREATE INDEX idx_contacts_user_type ON public.contacts(user_id, type);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY contacts_self_select ON public.contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY contacts_self_insert ON public.contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY contacts_self_update ON public.contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY contacts_self_delete ON public.contacts FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY contacts_coach_select ON public.contacts FOR SELECT USING (public.is_coach_of(auth.uid(), user_id));
CREATE POLICY contacts_admin_all ON public.contacts FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER contacts_set_updated_at BEFORE UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Backfill from existing transactions
INSERT INTO public.contacts (user_id, name, type)
SELECT DISTINCT user_id, trim(third_party),
  CASE WHEN type = 'IN' THEN 'CLIENT'::public.contact_type ELSE 'FOURNISSEUR'::public.contact_type END
FROM public.transactions
WHERE third_party IS NOT NULL AND trim(third_party) <> ''
ON CONFLICT (user_id, type, name) DO NOTHING;
