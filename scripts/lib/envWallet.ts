import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Keypair } from "@stellar/stellar-sdk";

export function loadDotEnv(root: string): Record<string, string> {
  const envPath = join(root, ".env");
  const out: Record<string, string> = {};
  if (!existsSync(envPath)) return out;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

export function resolveSecretKey(
  env: Record<string, string>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const fromProcess = process.env[key];
    if (fromProcess?.trim()) return fromProcess.trim();
    const fromFile = env[key];
    if (fromFile?.trim()) return fromFile.trim();
  }
  return undefined;
}

export function loadKeypairFromEnv(
  env: Record<string, string>,
  role: "patient" | "admin" | "deployer",
): Keypair | null {
  const secretKeys =
    role === "patient"
      ? ["PATIENT_SECRET_KEY"]
      : role === "admin"
        ? ["ADMIN_SECRET_KEY", "INSURER_SECRET_KEY", "DEPLOYER_SECRET_KEY"]
        : ["DEPLOYER_SECRET_KEY"];

  const secret = resolveSecretKey(env, secretKeys);
  if (secret) {
    return Keypair.fromSecret(secret);
  }
  return null;
}

export function resolvePublicKey(
  env: Record<string, string>,
  role: "patient" | "admin" | "deployer",
): string | undefined {
  const kp = loadKeypairFromEnv(env, role);
  if (kp) return kp.publicKey();

  const pubKeys =
    role === "patient"
      ? ["PATIENT_PUBLIC_KEY"]
      : role === "admin"
        ? ["ADMIN_PUBLIC_KEY", "INSURER_FUND_ADDRESS", "DEPLOYER_PUBLIC_KEY"]
        : ["DEPLOYER_PUBLIC_KEY"];

  return resolveSecretKey(env, pubKeys);
}
