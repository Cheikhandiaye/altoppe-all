
-- 1) Replace profiles_self_update with a column-safe version
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;

CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role_in_pos    IS NOT DISTINCT FROM (SELECT p.role_in_pos    FROM public.profiles p WHERE p.id = auth.uid())
    AND owner_user_id  IS NOT DISTINCT FROM (SELECT p.owner_user_id  FROM public.profiles p WHERE p.id = auth.uid())
    AND pos_id         IS NOT DISTINCT FROM (SELECT p.pos_id         FROM public.profiles p WHERE p.id = auth.uid())
    AND pin_hash       IS NOT DISTINCT FROM (SELECT p.pin_hash       FROM public.profiles p WHERE p.id = auth.uid())
    AND pin_salt       IS NOT DISTINCT FROM (SELECT p.pin_salt       FROM public.profiles p WHERE p.id = auth.uid())
    AND status         IS NOT DISTINCT FROM (SELECT p.status         FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 2) audit_log: ensure no authenticated write path. Revoke table privs;
--    writes happen via service_role only (server fns / SECURITY DEFINER).
REVOKE INSERT, UPDATE, DELETE ON public.audit_log FROM authenticated, anon;
GRANT ALL ON public.audit_log TO service_role;
