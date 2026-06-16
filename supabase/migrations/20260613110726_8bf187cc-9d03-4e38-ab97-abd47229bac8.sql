ALTER TABLE public.profiles ADD COLUMN onboarding_completed_at timestamptz;
UPDATE public.profiles SET onboarding_completed_at = now() WHERE onboarding_completed_at IS NULL;