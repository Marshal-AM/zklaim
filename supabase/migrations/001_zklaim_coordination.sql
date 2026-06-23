-- ZKlaim coordination tables (public directory + encrypted claim inbox)
-- Run in Supabase SQL Editor. No medical plaintext is stored.

-- ---------------------------------------------------------------------------
-- patient_profiles: Stellar address -> box public key (directory)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_profiles (
  stellar_address TEXT PRIMARY KEY,
  box_public_key TEXT NOT NULL,
  registration_message TEXT NOT NULL,
  registration_sig TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT patient_profiles_stellar_address_format
    CHECK (stellar_address ~ '^G[A-Z0-9]{55}$'),
  CONSTRAINT patient_profiles_box_public_key_nonempty
    CHECK (length(trim(box_public_key)) > 0),
  CONSTRAINT patient_profiles_registration_sig_nonempty
    CHECK (length(trim(registration_sig)) > 0)
);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS patient_profiles_updated_at ON public.patient_profiles;
CREATE TRIGGER patient_profiles_updated_at
  BEFORE UPDATE ON public.patient_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- claim_deliveries: encrypted claim tokens (ciphertext only)
-- ---------------------------------------------------------------------------
CREATE TYPE public.claim_delivery_status AS ENUM ('pending', 'imported', 'claimed');

CREATE TABLE IF NOT EXISTS public.claim_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_address TEXT NOT NULL,
  doctor_address TEXT NOT NULL,
  claim_nonce TEXT NOT NULL,
  encrypted_token JSONB NOT NULL,
  cid TEXT,
  status public.claim_delivery_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT claim_deliveries_patient_address_format
    CHECK (patient_address ~ '^G[A-Z0-9]{55}$'),
  CONSTRAINT claim_deliveries_doctor_address_format
    CHECK (doctor_address ~ '^G[A-Z0-9]{55}$'),
  CONSTRAINT claim_deliveries_claim_nonce_nonempty
    CHECK (length(trim(claim_nonce)) > 0),
  CONSTRAINT claim_deliveries_encrypted_token_object
    CHECK (jsonb_typeof(encrypted_token) = 'object'),
  UNIQUE (patient_address, claim_nonce)
);

DROP TRIGGER IF EXISTS claim_deliveries_updated_at ON public.claim_deliveries;
CREATE TRIGGER claim_deliveries_updated_at
  BEFORE UPDATE ON public.claim_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS claim_deliveries_patient_status_idx
  ON public.claim_deliveries (patient_address, status);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_deliveries ENABLE ROW LEVEL SECURITY;

-- Public directory: anyone can look up box public keys by Stellar address
DROP POLICY IF EXISTS patient_profiles_select_all ON public.patient_profiles;
CREATE POLICY patient_profiles_select_all
  ON public.patient_profiles
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS patient_profiles_insert_anon ON public.patient_profiles;
CREATE POLICY patient_profiles_insert_anon
  ON public.patient_profiles
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    stellar_address ~ '^G[A-Z0-9]{55}$'
    AND length(trim(box_public_key)) > 0
    AND length(trim(registration_sig)) > 0
  );

DROP POLICY IF EXISTS patient_profiles_update_anon ON public.patient_profiles;
CREATE POLICY patient_profiles_update_anon
  ON public.patient_profiles
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (
    stellar_address ~ '^G[A-Z0-9]{55}$'
    AND length(trim(box_public_key)) > 0
    AND length(trim(registration_sig)) > 0
  );

-- Deliveries: ciphertext only; SELECT open (must know patient address to filter)
DROP POLICY IF EXISTS claim_deliveries_select_all ON public.claim_deliveries;
CREATE POLICY claim_deliveries_select_all
  ON public.claim_deliveries
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS claim_deliveries_insert_anon ON public.claim_deliveries;
CREATE POLICY claim_deliveries_insert_anon
  ON public.claim_deliveries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    patient_address ~ '^G[A-Z0-9]{55}$'
    AND doctor_address ~ '^G[A-Z0-9]{55}$'
    AND length(trim(claim_nonce)) > 0
    AND jsonb_typeof(encrypted_token) = 'object'
    AND status = 'pending'
  );

DROP POLICY IF EXISTS claim_deliveries_update_status ON public.claim_deliveries;
CREATE POLICY claim_deliveries_update_status
  ON public.claim_deliveries
  FOR UPDATE
  TO anon, authenticated
  USING (status IN ('pending', 'imported'))
  WITH CHECK (status IN ('imported', 'claimed'));

-- ---------------------------------------------------------------------------
-- Realtime (patient inbox notifications)
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.claim_deliveries;
