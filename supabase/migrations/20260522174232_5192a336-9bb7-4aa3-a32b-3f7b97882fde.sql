-- 1. Remove client-facing INSERT policy on audit_log (privilege escalation)
DROP POLICY IF EXISTS audit_self_insert ON public.audit_log;

-- 2. Revoke EXECUTE on SECURITY DEFINER functions from public roles.
-- These functions are still callable internally by RLS policies and triggers
-- (they run as the function owner regardless of caller grants used for RLS evaluation).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_coach_of(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;