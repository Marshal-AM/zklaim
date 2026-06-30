/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STELLAR_RPC_URL: string;
  readonly VITE_STELLAR_NETWORK_PASSPHRASE: string;
  readonly VITE_CLAIM_ESCROW_CONTRACT_ID: string;
  readonly VITE_DEDUCTIBLE_TRACKER_CONTRACT_ID: string;
  readonly VITE_ASP_MEMBER_CONTRACT_ID: string;
  readonly VITE_ASP_FRAUD_CONTRACT_ID: string;
  readonly VITE_POLICY_REGISTRY_CONTRACT_ID: string;
  readonly VITE_USDC_TOKEN_CONTRACT_ID: string;
  readonly VITE_USDC_ISSUER: string;
  readonly VITE_INSURER_FUND_ADDRESS: string;
  readonly VITE_INSURER_VIEW_PUBLIC_KEY?: string;
  /** Demo only — exposes insurer decrypt key in the client bundle. */
  readonly VITE_INSURER_VIEW_SECRET_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_FREIGHTER_DEBUG?: string;
  readonly VITE_SUBMIT_CLAIM_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
