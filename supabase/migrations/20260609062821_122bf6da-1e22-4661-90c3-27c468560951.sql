
DROP POLICY IF EXISTS profiles_seller_select_owner ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_owner_active_activity_id(_uid uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.active_activity_id
  FROM public.profiles p
  WHERE p.id = public.get_owner_id(_uid)
$$;

REVOKE EXECUTE ON FUNCTION public.get_owner_active_activity_id(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_owner_active_activity_id(uuid) TO authenticated;
