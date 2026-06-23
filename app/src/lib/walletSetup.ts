import {
  Asset,
  Operation,
  rpc,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { env } from "../config/env";
import { freighterSignTransaction } from "./freighter";

export type SetupStepStatus = "idle" | "active" | "done" | "error" | "skipped";

const HORIZON = "https://horizon-testnet.stellar.org";
const FRIENDBOT = "https://friendbot.stellar.org";

async function accountExists(publicKey: string): Promise<boolean> {
  const res = await fetch(`${HORIZON}/accounts/${publicKey}`);
  return res.ok;
}

async function hasUsdcTrustline(publicKey: string): Promise<boolean> {
  const issuer = env.usdcIssuer();
  const res = await fetch(`${HORIZON}/accounts/${publicKey}`);
  if (!res.ok) return false;
  const account = (await res.json()) as {
    balances: Array<{
      asset_type: string;
      asset_code?: string;
      asset_issuer?: string;
    }>;
  };
  return account.balances.some(
    (b) =>
      b.asset_type !== "native" &&
      b.asset_code === "USDC" &&
      b.asset_issuer === issuer,
  );
}

export async function fundWithFriendbot(publicKey: string): Promise<string> {
  const res = await fetch(`${FRIENDBOT}?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) {
    throw new Error(`Friendbot request failed (${res.status})`);
  }
  const data = (await res.json()) as {
    hash?: string;
    successful?: boolean;
  };
  if (!data.hash) {
    throw new Error("Friendbot did not return a transaction hash");
  }
  return data.hash;
}

export async function ensureUsdcTrustline(publicKey: string): Promise<string | null> {
  if (await hasUsdcTrustline(publicKey)) {
    return null;
  }

  const server = new rpc.Server(env.rpcUrl);
  const account = await server.getAccount(publicKey);
  const tx = new TransactionBuilder(account, {
    fee: "1000",
    networkPassphrase: env.networkPassphrase,
  })
    .addOperation(
      Operation.changeTrust({
        asset: new Asset("USDC", env.usdcIssuer()),
      }),
    )
    .setTimeout(60)
    .build();

  const signed = await freighterSignTransaction(tx);
  const sent = await server.sendTransaction(signed);
  const result = await server.pollTransaction(sent.hash);
  if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`USDC trustline failed: ${result.status}`);
  }
  return result.txHash;
}

export async function setupFreighterWallet(
  publicKey: string,
  onStep?: (index: number, status: SetupStepStatus, detail?: string) => void,
): Promise<void> {
  onStep?.(0, "active", "Checking account on testnet...");
  try {
    if (await accountExists(publicKey)) {
      onStep?.(0, "done", `${publicKey.slice(0, 8)}… funded`);
    } else {
      onStep?.(0, "active", "Requesting testnet XLM via Friendbot...");
      const hash = await fundWithFriendbot(publicKey);
      onStep?.(0, "done", `Funded (tx: ${hash.slice(0, 8)}…)`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Friendbot funding failed";
    onStep?.(0, "error", message);
    throw err;
  }

  onStep?.(1, "active", "Building USDC trustline transaction...");
  try {
    const hash = await ensureUsdcTrustline(publicKey);
    onStep?.(
      1,
      "done",
      hash ? `USDC trustline active (${hash.slice(0, 8)}…)` : "USDC trustline already active",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Trustline setup failed";
    onStep?.(1, "error", message);
    throw err;
  }
}
