-- Mobile OTP access for PlotMap_MAEP.
-- Run this once in the Supabase SQL Editor before deploying the mobile OTP feature.
ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS mobile_number text;

CREATE UNIQUE INDEX IF NOT EXISTS user_access_mobile_number_unique
  ON public.user_access (mobile_number)
  WHERE mobile_number IS NOT NULL;

-- New accounts are created as approved only after the SMS OTP is verified.
