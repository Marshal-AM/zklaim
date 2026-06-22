import { BN254_MODULUS } from "./constants.js";

export function modField(value: bigint): bigint {
  const v = value % BN254_MODULUS;
  return v >= 0n ? v : v + BN254_MODULUS;
}

export function fieldToHex(value: bigint): string {
  return "0x" + modField(value).toString(16).padStart(64, "0");
}

export function fieldFromHex(hex: string): bigint {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return modField(BigInt("0x" + clean));
}

export function fieldToBytesBE(value: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let v = modField(value);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

export function bytesBEToField(bytes: Uint8Array): bigint {
  let v = 0n;
  for (const b of bytes) {
    v = (v << 8n) + BigInt(b);
  }
  return modField(v);
}

/** Deterministic string → field (UTF-8 bytes padded/truncated to 32 bytes BE) */
export function stringToField(input: string): bigint {
  const enc = new TextEncoder().encode(input);
  const buf = new Uint8Array(32);
  buf.set(enc.slice(0, 32));
  return bytesBEToField(buf);
}

/** ICD-10 code → field (e.g. "J18.9") */
export function icdToField(code: string): bigint {
  return stringToField(code.toUpperCase());
}

/** Amount range bucket label → field */
export function amountBucketToField(minCents: number, maxCents: number): bigint {
  return stringToField(`${minCents}-${maxCents}`);
}

/** Provider pattern label → field */
export function providerPatternToField(pattern: string): bigint {
  return stringToField(pattern);
}

/** ICD category from code prefix (first 3 chars e.g. J18) */
export function icdCategoryToField(code: string): bigint {
  const normalized = code.toUpperCase().replace(".", "");
  const category = normalized.slice(0, 3);
  return stringToField(category);
}
