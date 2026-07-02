/**
 * Diagnose Soroban footprint / storage-key hypotheses for submit_claim.
 *
 * Usage:
 *   npx tsx scripts/diagnose_soroban_footprint.ts
 *   npx tsx scripts/diagnose_soroban_footprint.ts --patient GAQ5S6CJ...
 *   npx tsx scripts/diagnose_soroban_footprint.ts --nullifier 0x12245899...
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Address,
  BASE_FEE,
  Contract,
  Networks,
  Operation,
  rpc,
  StrKey,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import {
  createUnsignedClaimPreparer,
  generateClaimProofs,
} from "@zklaim/proof-gen";
import { ensureNodeProofGenInitialized } from "@zklaim/proof-gen/nodeInit";
import { loadDemoClaimData } from "@zklaim/proof-gen/demo";

function nullifierToHex(value: bigint | Uint8Array): string {
  if (typeof value === "bigint") {
    const hex = value.toString(16).padStart(64, "0");
    return `0x${hex}`;
  }
  return `0x${Buffer.from(value).toString("hex")}`;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnv(): Record<string, string> {
  const envPath = join(ROOT, ".env");
  const out: Record<string, string> = {};
  if (!existsSync(envPath)) return out;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

function contractIdFromHashHex(hashHex: string): string | null {
  try {
    const bytes = Buffer.from(hashHex, "hex");
    if (bytes.length !== 32) return null;
    return StrKey.encodeContract(bytes);
  } catch {
    return null;
  }
}

function decodeContractDataKey(key: xdr.LedgerKey): string {
  if (key.switch().name !== "contractData") return key.switch().name;
  const data = key.contractData();
  const contract = Address.fromScAddress(data.contract()).toString();
  const sym = data.key().switch().name;
  let detail = sym;
  try {
    const val = data.key().value();
    if (sym === "scvVec" && val && typeof val === "object" && "length" in val) {
      const parts: string[] = [];
      for (let i = 0; i < (val as xdr.ScVal[]).length; i++) {
        const item = (val as xdr.ScVal[])[i];
        const t = item.switch().name;
        if (t === "scvSymbol") {
          parts.push(`Symbol("${item.sym().toString()}")`);
        } else if (t === "scvU32") {
          parts.push(`U32(${item.u32()})`);
        } else if (t === "scvBytes") {
          const b = item.bytes();
          parts.push(`Bytes(${Buffer.from(b).toString("hex").slice(0, 16)}…)`);
        } else if (t === "scvAddress") {
          parts.push(`Address(${Address.fromScAddress(item.address()).toString().slice(0, 8)}…)`);
        } else {
          parts.push(t);
        }
      }
      detail = `Vec([${parts.join(", ")}])`;
    }
  } catch {
    // keep sym name only
  }
  const durability = data.durability().name;
  return `contractData:${contract.slice(0, 8)}… key=${detail} durability=${durability}`;
}

async function ledgerEntryExists(
  server: rpc.Server,
  key: xdr.LedgerKey,
): Promise<{ exists: boolean; liveUntil?: number }> {
  const res = await server.getLedgerEntries(key);
  if (res.entries.length === 0) return { exists: false };
  return {
    exists: true,
    liveUntil: res.entries[0].liveUntilLedgerSeq,
  };
}

async function simulatePreviewPayout(
  server: rpc.Server,
  escrowId: string,
  patient: string,
  networkPassphrase: string,
): Promise<void> {
  console.log("\n=== 1. preview_payout (read-only smoke) ===");
  const account = await server.getAccount(patient);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: escrowId,
        function: "preview_payout",
        args: [xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: xdr.Int64.fromString("0"), lo: xdr.Uint64.fromString("100") })), xdr.ScVal.scvBool(true)],
      }),
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    console.log("  FAIL simulation:", sim.error);
    return;
  }
  console.log("  OK simulation");
  const prepared = await server.prepareTransaction(tx);
  const ext = prepared.toEnvelope().v1()?.tx()?.ext();
  const soroban = ext?.switch() === 1 ? ext.sorobanData() : null;
  const fp = soroban?.resources().footprint();
  console.log("  footprint RW:", fp?.readWrite().length ?? 0, "RO:", fp?.readOnly().length ?? 0);
}

async function simulateSubmitClaim(
  server: rpc.Server,
  escrowId: string,
  patient: string,
  networkPassphrase: string,
  rpcUrl: string,
  env: Record<string, string>,
  nullifierArg?: string,
): Promise<void> {
  console.log("\n=== 2. submit_claim simulation + footprint decode ===");
  const claim = await loadDemoClaimData();
  if (!claim.insurer) {
    claim.insurer =
      env.INSURER_FUND_ADDRESS ?? env.DEPLOYER_PUBLIC_KEY ?? "";
  }
  if (!claim.insurer) {
    throw new Error("Set INSURER_FUND_ADDRESS or DEPLOYER_PUBLIC_KEY in .env");
  }
  const proofPkg = await generateClaimProofs(claim, { useWorkers: false });
  const nullifier = nullifierToHex(proofPkg.nullifier);
  console.log("  nullifier:", nullifier);
  if (nullifierArg && nullifierArg.replace(/^0x/, "").toLowerCase() !== nullifier.replace(/^0x/, "").toLowerCase()) {
    console.log("  (note: --nullifier arg differs from demo claim nullifier)");
  }

  const getUnsigned = createUnsignedClaimPreparer({
    proofPackage: proofPkg,
    patientPublicKey: patient,
    escrowContractId: escrowId,
    rpcUrl,
    networkPassphrase,
  });
  const unsigned = await getUnsigned();
  const sim = await server.simulateTransaction(unsigned);
  if (rpc.Api.isSimulationError(sim)) {
    console.log("  FAIL simulation:", JSON.stringify(sim.error));
    return;
  }
  console.log("  OK simulation, minResourceFee:", sim.minResourceFee);

  const prepared = await server.prepareTransaction(unsigned);
  const soroban = prepared.toEnvelope().v1()!.tx()!.ext()!.sorobanData()!;
  const footprint = soroban.resources().footprint();

  const tracker = env.DEDUCTIBLE_TRACKER_CONTRACT_ID ?? "";
  const aspMember = env.ASP_MEMBER_CONTRACT_ID ?? "";

  console.log("\n  Contract IDs:");
  console.log("    claim_escrow (nullifier):", escrowId);
  console.log("    deductible_tracker:    ", tracker);
  console.log("    asp_member (Leaf keys):  ", aspMember);

  const rw = footprint.readWrite();
  const ro = footprint.readOnly();
  console.log(`\n  Read-write footprint (${rw.length}):`);
  for (const key of rw) {
    const label = decodeContractDataKey(key);
    const exists = key.switch().name === "contractData"
      ? await ledgerEntryExists(server, key)
      : { exists: true as const };
    console.log(`    ${label}`);
    console.log(`      on-chain: ${exists.exists ? `yes (ttl=${exists.liveUntil ?? "n/a"})` : "NOT FOUND"}`);
  }

  console.log(`\n  Read-only footprint (${ro.length}) — contractData samples:`);
  let leafMissing = 0;
  let leafPresent = 0;
  for (const key of ro) {
    if (key.switch().name !== "contractData") continue;
    const label = decodeContractDataKey(key);
    if (!label.includes("Symbol(\"Leaf\")")) continue;
    const exists = await ledgerEntryExists(server, key);
    if (exists.exists) leafPresent++;
    else leafMissing++;
    if (leafMissing + leafPresent <= 8) {
      console.log(`    ${label} → ${exists.exists ? "exists" : "NOT FOUND"}`);
    }
  }
  if (leafMissing + leafPresent > 8) {
    console.log(`    … ${leafPresent} Leaf keys exist, ${leafMissing} NOT FOUND (of ${leafPresent + leafMissing} in RO footprint)`);
  }

  // Explicit nullifier + accumulator probes
  console.log("\n=== 3. Targeted storage probes ===");
  const nullifierBytes = Buffer.from(nullifier.replace(/^0x/, ""), "hex");
  const escrowContract = new Contract(escrowId);
  const nullifierProbe = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: escrowContract.address().toScAddress(),
      key: xdr.ScVal.scvVec([
        xdr.ScVal.scvSymbol("Nullifier"),
        xdr.ScVal.scvBytes(nullifierBytes),
      ]),
      durability: xdr.ContractDataDurability.persistent(),
    }),
  );
  const nullifierOnChain = await ledgerEntryExists(server, nullifierProbe);
  console.log(
    `  Nullifier[${nullifier.slice(0, 18)}…] on claim_escrow:`,
    nullifierOnChain.exists ? "EXISTS (already spent)" : "does not exist (expected for first claim)",
  );

  if (tracker) {
    const trackerContract = new Contract(tracker);
    const accumProbe = xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: trackerContract.address().toScAddress(),
        key: xdr.ScVal.scvVec([
          xdr.ScVal.scvSymbol("Accumulator"),
          new Address(patient).toScVal(),
        ]),
        durability: xdr.ContractDataDurability.persistent(),
      }),
    );
    const accumOnChain = await ledgerEntryExists(server, accumProbe);
    console.log(
      `  Accumulator[${patient.slice(0, 8)}…] on deductible_tracker:`,
      accumOnChain.exists ? `EXISTS (ttl=${accumOnChain.liveUntil})` : "does NOT exist (first claim for patient)",
    );
  }

  // Hash from restore error in logs
  const leafHash = "500969816629db03776050a44c3c85a726bee9df688607a9aa0efc69a990cdb8";
  const leafContract = contractIdFromHashHex(leafHash);
  console.log(
    `\n  Restore-error contract hash ${leafHash.slice(0, 16)}… →`,
    leafContract ?? "decode failed",
  );
  if (leafContract && leafContract === aspMember) {
    console.log("  → matches ASP_MEMBER (Leaf merkle storage, NOT nullifier)");
  }

  console.log("\n=== 4. Code facts (static) ===");
  console.log("  claim_escrow nullifier::is_spent uses storage.has() — correct");
  console.log("  claim_escrow mark_spent uses storage.set() at end of submit — intentional write");
  console.log("  deductible_tracker get_accumulator uses storage.has() before get");
  console.log("  asp_membership leaf_at uses storage.has() before get");
  console.log("  client restore: empty getLedgerEntries → skip; TTL-expired live entry → restore");
}

async function main() {
  ensureNodeProofGenInitialized();
  const env = loadEnv();
  const rpcUrl = env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
  const networkPassphrase = env.STELLAR_NETWORK_PASSPHRASE ?? Networks.TESTNET;
  const escrowId = env.CLAIM_ESCROW_CONTRACT_ID;
  if (!escrowId) throw new Error("CLAIM_ESCROW_CONTRACT_ID missing in .env");

  const patientArg = process.argv.find((a, i) => process.argv[i - 1] === "--patient");
  const nullifierArg = process.argv.find((a, i) => process.argv[i - 1] === "--nullifier");
  const patient =
    patientArg ??
    process.env.PATIENT_PUBLIC_KEY ??
    "GAQ5S6CJWD5K4SAKNSYUEOAB7FT2JFUJY4XSZWKODS2NLHMN3IS467O6";

  console.log("RPC:", rpcUrl);
  console.log("Patient:", patient);
  console.log("Escrow:", escrowId);

  const server = new rpc.Server(rpcUrl);
  await simulatePreviewPayout(server, escrowId, patient, networkPassphrase);
  await simulateSubmitClaim(
    server,
    escrowId,
    patient,
    networkPassphrase,
    rpcUrl,
    env,
    nullifierArg,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
