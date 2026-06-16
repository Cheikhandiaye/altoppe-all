
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS raw_extraction jsonb,
  ADD COLUMN IF NOT EXISTS coach_note text;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_external_id_uq
  ON public.transactions (user_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ai_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL,
  external_id text,
  transcript text,
  raw_response jsonb,
  error_message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_errors_self_select ON public.ai_errors
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY ai_errors_self_insert ON public.ai_errors
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY ai_errors_admin_all ON public.ai_errors
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS ai_errors_user_created_idx
  ON public.ai_errors (user_id, created_at DESC);
