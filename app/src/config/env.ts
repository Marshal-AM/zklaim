function requireEnv(key: keyof ImportMetaEnv): string {
  const value = import.meta.env[key];
  if (!value) {
    throw new Error(`Missing ${key} — copy .env.example and set VITE_* variables`);
  }
  return value;
}

export const env = {
  rpcUrl:
    import.meta.env.VITE_STELLAR_RPC_URL ??
    "https://soroban-testnet.stellar.org",
  networkPassphrase:
    import.meta.env.VITE_STELLAR_NETWORK_PASSPHRASE ??
    "Test SDF Network ; September 2015",
  claimEscrowId: () => requireEnv("VITE_CLAIM_ESCROW_CONTRACT_ID"),
  deductibleTrackerId: () => requireEnv("VITE_DEDUCTIBLE_TRACKER_CONTRACT_ID"),
  aspMemberId: () => requireEnv("VITE_ASP_MEMBER_CONTRACT_ID"),
  aspFraudId: () => requireEnv("VITE_ASP_FRAUD_CONTRACT_ID"),
  policyRegistryId: () => requireEnv("VITE_POLICY_REGISTRY_CONTRACT_ID"),
  usdcTokenId: () => requireEnv("VITE_USDC_TOKEN_CONTRACT_ID"),
  usdcIssuer: () => requireEnv("VITE_USDC_ISSUER"),
  insurerFundAddress: () => requireEnv("VITE_INSURER_FUND_ADDRESS"),
  /** On-chain admin / insurer (deployer) — used for ASP, policy, passport admin txs. */
  adminAddress: () =>
    import.meta.env.VITE_DEPLOYER_PUBLIC_KEY ??
    requireEnv("VITE_INSURER_FUND_ADDRESS"),
  /** Base64 NaCl box public key for insurer selective-disclosure (optional). */
  insurerViewPublicKey: () => import.meta.env.VITE_INSURER_VIEW_PUBLIC_KEY ?? "",
  hasInsurerViewKey: () => Boolean(import.meta.env.VITE_INSURER_VIEW_PUBLIC_KEY),
  supabaseUrl: () => import.meta.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey: () => import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  isSupabaseEnabled: () =>
    Boolean(
      import.meta.env.VITE_SUPABASE_URL &&
        import.meta.env.VITE_SUPABASE_ANON_KEY,
    ),
};
