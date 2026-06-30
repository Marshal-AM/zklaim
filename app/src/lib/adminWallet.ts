import { Keypair } from "@stellar/stellar-sdk";
import { env } from "../config/env";

/** Demo/testnet only — secret is bundled via VITE_DEPLOYER_SECRET_KEY. */
export function hasAdminSigningKey(): boolean {
  return Boolean(import.meta.env.VITE_DEPLOYER_SECRET_KEY?.trim());
}

export function getAdminKeypair(): Keypair {
  const secret = import.meta.env.VITE_DEPLOYER_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error(
      "Missing VITE_DEPLOYER_SECRET_KEY in .env — required for admin transactions (demo).",
    );
  }
  return Keypair.fromSecret(secret);
}

/** On-chain admin address; prefers keypair derived from secret when set. */
export function resolveAdminAddress(): string {
  if (hasAdminSigningKey()) {
    return getAdminKeypair().publicKey();
  }
  return env.adminAddress();
}

export function requireAdminSigning(): string {
  if (!hasAdminSigningKey()) {
    throw new Error(
      "Set VITE_DEPLOYER_SECRET_KEY in .env — admin transactions are signed automatically (demo only).",
    );
  }
  return resolveAdminAddress();
}
