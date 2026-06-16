CREATE TABLE public.business_model_canvas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  activity_description text,
  key_partners text,
  key_activities text,
  key_resources text,
  value_propositions text,
  customer_relationships text,
  channels text,
  customer_segments text,
  cost_structure text,
  revenue_streams text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_model_canvas ENABLE ROW LEVEL SECURITY;

CREATE POLICY bmc_admin_all ON public.business_model_canvas FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY bmc_self_select ON public.business_model_canvas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY bmc_coach_select ON public.business_model_canvas FOR SELECT
  USING (is_coach_of(auth.uid(), user_id));

CREATE POLICY bmc_coach_insert ON public.business_model_canvas FOR INSERT
  WITH CHECK (is_coach_of(auth.uid(), user_id));

CREATE POLICY bmc_coach_update ON public.business_model_canvas FOR UPDATE
  USING (is_coach_of(auth.uid(), user_id));

CREATE TRIGGER bmc_set_updated_at
  BEFORE UPDATE ON public.business_model_canvas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();