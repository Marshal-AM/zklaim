import {
  Address,
  xdr,
  nativeToScVal,
  scValToNative,
} from "@stellar/stellar-sdk";
import { fieldToBytesBE } from "@zklaim/scripts";
import type { ClaimPackageOnChain, ProofPackage } from "../inputs.js";
import { encodePublicInputs } from "../circuits.js";

function bytesScVal(bytes: Uint8Array): xdr.ScVal {
  return xdr.ScVal.scvBytes(Buffer.from(bytes));
}

function bytesVecScVal(items: Uint8Array[]): xdr.ScVal {
  return xdr.ScVal.scvVec(items.map(bytesScVal));
}

function u32VecScVal(items: number[]): xdr.ScVal {
  return xdr.ScVal.scvVec(items.map((i) => xdr.ScVal.scvU32(i)));
}

function mapEntry(key: string, val: xdr.ScVal): xdr.ScMapEntry {
  return new xdr.ScMapEntry({
    key: xdr.ScVal.scvSymbol(key),
    val,
  });
}

export function buildClaimPackageOnChain(pkg: ProofPackage): ClaimPackageOnChain {
  return {
    policy_proof: pkg.policyResult.proof,
    policy_inputs: encodePublicInputs(pkg.policyResult.publicInputs),
    amount_proof: pkg.amountResult.proof,
    amount_inputs: encodePublicInputs(pkg.amountResult.publicInputs),
    doctor_proof: pkg.doctorResult.proof,
    doctor_inputs: encodePublicInputs(pkg.doctorResult.publicInputs),
    accum_proof: pkg.accumResult.proof,
    accum_inputs: encodePublicInputs(pkg.accumResult.publicInputs),
    fraud_non_membership_proof: pkg.fraud.fraud_non_membership_proof,
    fraud_path_indices: pkg.fraud.fraud_path_indices,
    nullifier: fieldToBytesBE(pkg.nullifier),
    billing_pattern_hash: fieldToBytesBE(pkg.fraud.billing_pattern_hash),
    insurer: pkg.insurer,
    payout_amount: pkg.payout_amount,
  };
}

export function claimPackageToScVal(pkg: ClaimPackageOnChain): xdr.ScVal {
  const insurerAddr = new Address(pkg.insurer);
  return xdr.ScVal.scvMap([
    mapEntry("policy_proof", bytesScVal(pkg.policy_proof)),
    mapEntry("policy_inputs", bytesVecScVal(pkg.policy_inputs)),
    mapEntry("amount_proof", bytesScVal(pkg.amount_proof)),
    mapEntry("amount_inputs", bytesVecScVal(pkg.amount_inputs)),
    mapEntry("doctor_proof", bytesScVal(pkg.doctor_proof)),
    mapEntry("doctor_inputs", bytesVecScVal(pkg.doctor_inputs)),
    mapEntry("accum_proof", bytesScVal(pkg.accum_proof)),
    mapEntry("accum_inputs", bytesVecScVal(pkg.accum_inputs)),
    mapEntry(
      "fraud_non_membership_proof",
      bytesVecScVal(pkg.fraud_non_membership_proof),
    ),
    mapEntry("fraud_path_indices", u32VecScVal(pkg.fraud_path_indices)),
    mapEntry("nullifier", bytesScVal(pkg.nullifier)),
    mapEntry("billing_pattern_hash", bytesScVal(pkg.billing_pattern_hash)),
    mapEntry("insurer", insurerAddr.toScVal()),
    mapEntry(
      "payout_amount",
      nativeToScVal(pkg.payout_amount, { type: "i128" }),
    ),
  ]);
}

/** Round-trip helper for tests */
export function scValToClaimPackage(val: xdr.ScVal): Record<string, unknown> {
  return scValToNative(val) as Record<string, unknown>;
}
