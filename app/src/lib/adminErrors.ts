/** Map opaque Soroban admin traps to actionable messages. */
export function explainAdminContractError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("vite_deployer_secret_key")) {
    return raw;
  }
  if (
    lower.includes("unreachablecodereached") &&
    (lower.includes("register_verifier") ||
      lower.includes("enroll_doctor") ||
      lower.includes("insert_pattern") ||
      lower.includes("register_policy"))
  ) {
    return (
      "Transaction rejected: admin signer mismatch or missing VITE_DEPLOYER_SECRET_KEY. " +
      "Set the deployer secret in .env so admin transactions sign automatically (demo only)."
    );
  }
  if (lower.includes("unauthorized")) {
    return (
      "Unauthorized — ensure VITE_DEPLOYER_SECRET_KEY matches the on-chain admin address."
    );
  }
  return raw;
}
