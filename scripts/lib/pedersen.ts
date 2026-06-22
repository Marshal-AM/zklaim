import { BarretenbergSync } from "@aztec/bb.js";
import { fieldToBytesBE, modField } from "./field.js";

let bb: BarretenbergSync | null = null;

async function initBb(): Promise<BarretenbergSync> {
  if (!bb) {
    bb = await BarretenbergSync.initSingleton();
  }
  return bb;
}

/** Pedersen commitment x-coordinate matching Noir std::hash::pedersen_commitment([a,b]).x */
export async function pedersenCommit(
  value: bigint,
  blinding: bigint,
): Promise<bigint> {
  const api = await initBb();
  const response = api.pedersenCommit({
    inputs: [fieldToBytesBE(modField(value)), fieldToBytesBE(modField(blinding))],
    hashIndex: 0,
  });
  const xBytes = response.point.x;
  let x = 0n;
  for (let i = 0; i < xBytes.length; i++) {
    x = (x << 8n) + BigInt(xBytes[i]);
  }
  return modField(x);
}
