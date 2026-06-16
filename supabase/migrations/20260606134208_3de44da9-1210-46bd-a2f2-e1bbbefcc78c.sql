
-- Add a persisted default POS to profiles, and backfill from first non-archived POS per owner.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_pos_id uuid REFERENCES public.points_of_sale(id) ON DELETE SET NULL;

-- Backfill : pour chaque profil OWNER (ou self), prendre son premier PV non archivé.
WITH first_pos AS (
  SELECT DISTINCT ON (owner_user_id) owner_user_id, id
  FROM public.points_of_sale
  WHERE is_archived = false
  ORDER BY owner_user_id, created_at ASC
)
UPDATE public.profiles p
SET active_pos_id = fp.id
FROM first_pos fp
WHERE p.active_pos_id IS NULL
  AND p.id = fp.owner_user_id;

-- Pour les vendeurs, refléter leur pos_id forcé dans active_pos_id (pour cohérence des reads)
UPDATE public.profiles
SET active_pos_id = pos_id
WHERE role_in_pos = 'SELLER'
  AND pos_id IS NOT NULL
  AND active_pos_id IS DISTINCT FROM pos_id;
