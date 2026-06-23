import { env } from "../config/env";

const HORIZON = "https://horizon-testnet.stellar.org";

export async function fetchUsdcBalance(
  accountId: string,
): Promise<number> {
  const issuer = env.usdcIssuer();
  const url = `${HORIZON}/accounts/${accountId}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return 0;
    throw new Error(`Horizon error: ${res.status}`);
  }
  const data = (await res.json()) as {
    balances: Array<{
      asset_type: string;
      asset_code?: string;
      asset_issuer?: string;
      balance: string;
    }>;
  };
  const usdc = data.balances.find(
    (b) =>
      b.asset_type !== "native" &&
      b.asset_code === "USDC" &&
      b.asset_issuer === issuer,
  );
  if (!usdc) return 0;
  return Math.round(parseFloat(usdc.balance) * 1_000_000) / 10_000;
}

export function formatUsdc(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

/** Horizon USDC balance string (matches stellar-mobile-agents wallet helper). */
export async function getTokenBalances(address: string): Promise<{ usdc: string }> {
  try {
    const issuer = env.usdcIssuer();
    const url = `${HORIZON}/accounts/${address}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Unable to fetch Stellar account (${res.status})`);
    }
    const account = (await res.json()) as {
      balances: Array<{
        asset_type: string;
        asset_code?: string;
        asset_issuer?: string;
        balance: string;
      }>;
    };
    const usdcEntry = account.balances.find(
      (b) =>
        b.asset_type !== "native" &&
        b.asset_code === "USDC" &&
        b.asset_issuer === issuer,
    );
    const numeric = parseFloat(usdcEntry?.balance ?? "0");
    const usdc = Number.isFinite(numeric) ? numeric.toFixed(5) : "0.00000";
    return { usdc };
  } catch {
    return { usdc: "0.00000" };
  }
}
