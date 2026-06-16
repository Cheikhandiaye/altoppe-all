DROP POLICY IF EXISTS txn_self_update ON public.transactions;
CREATE POLICY txn_self_update ON public.transactions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS txn_coach_update ON public.transactions;
CREATE POLICY txn_coach_update ON public.transactions
  FOR UPDATE TO authenticated
  USING (public.is_coach_of(auth.uid(), user_id))
  WITH CHECK (public.is_coach_of(auth.uid(), user_id) AND user_id = (SELECT t.user_id FROM public.transactions t WHERE t.id = transactions.id));