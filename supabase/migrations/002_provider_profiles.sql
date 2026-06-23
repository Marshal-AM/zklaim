-- Provider wallet registry (links Freighter address -> demo ASP credential)
-- Run in Supabase SQL Editor after 001_zklaim_coordination.sql

CREATE TABLE IF NOT EXISTS public.provider_profiles (
  stellar_address TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  specialty_code TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  registration_message TEXT NOT NULL,
  registration_sig TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT provider_profiles_stellar_address_format
    CHECK (stellar_address ~ '^G[A-Z0-9]{55}$'),
  CONSTRAINT provider_profiles_license_id_nonempty
    CHECK (length(trim(license_id)) > 0),
  CONSTRAINT provider_profiles_registration_sig_nonempty
    CHECK (length(trim(registration_sig)) > 0)
);

DROP TRIGGER IF EXISTS provider_profiles_updated_at ON public.provider_profiles;
CREATE TRIGGER provider_profiles_updated_at
  BEFORE UPDATE ON public.provider_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.provider_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_profiles_select_all ON public.provider_profiles;
CREATE POLICY provider_profiles_select_all
  ON public.provider_profiles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS provider_profiles_insert_anon ON public.provider_profiles;
CREATE POLICY provider_profiles_insert_anon
  ON public.provider_profiles
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    stellar_address ~ '^G[A-Z0-9]{55}$'
    AND length(trim(license_id)) > 0
    AND length(trim(registration_sig)) > 0
  );

DROP POLICY IF EXISTS provider_profiles_update_anon ON public.provider_profiles;
CREATE POLICY provider_profiles_update_anon
  ON public.provider_profiles
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (
    stellar_address ~ '^G[A-Z0-9]{55}$'
    AND length(trim(license_id)) > 0
    AND length(trim(registration_sig)) > 0
  );
