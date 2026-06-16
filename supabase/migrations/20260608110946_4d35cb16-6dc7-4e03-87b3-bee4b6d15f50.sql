
-- 1) BMC: allow self insert and update
CREATE POLICY "bmc_self_insert" ON public.business_model_canvas
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bmc_self_update" ON public.business_model_canvas
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2) Protect PIN columns from being read via RLS-permitted SELECT *
REVOKE SELECT (pin_hash, pin_salt) ON public.profiles FROM authenticated, anon;

-- Secure accessor: only own pin_hash
CREATE OR REPLACE FUNCTION public.get_my_pin_hash()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pin_hash FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.get_my_pin_hash() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_pin_hash() TO authenticated;
