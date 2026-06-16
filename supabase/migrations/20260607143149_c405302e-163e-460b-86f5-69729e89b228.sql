ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_credit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_amount numeric(14,2) NOT NULL DEFAULT 0;

-- Backfill: existing transactions are considered fully paid
UPDATE public.transactions SET paid_amount = amount WHERE paid_amount = 0 AND is_credit = false;

CREATE INDEX IF NOT EXISTS idx_txn_credit_open
  ON public.transactions (user_id, activity_id, pos_id)
  WHERE is_credit = true AND paid_amount < amount;