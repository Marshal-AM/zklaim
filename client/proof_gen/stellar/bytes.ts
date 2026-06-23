/** Browser + Node safe byte helpers (no Node Buffer required). */

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

export function xdrObjectToBytes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: { toXDR: (...args: any[]) => any },
): Uint8Array {
  const raw: unknown = value.toXDR("raw");
  if (raw instanceof Uint8Array) {
    return raw;
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    "type" in raw &&
    (raw as Record<string, unknown>)["type"] === "Buffer" &&
    Array.isArray((raw as Record<string, unknown>)["data"])
  ) {
    return new Uint8Array((raw as unknown as { data: number[] }).data);
  }
  const b64: unknown = value.toXDR("base64");
  return base64ToBytes(b64 as string);
}

export function coerceToUint8Array(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as Record<string, unknown>)["type"] === "Buffer" &&
    Array.isArray((value as Record<string, unknown>)["data"])
  ) {
    return new Uint8Array((value as unknown as { data: number[] }).data);
  }
  if (typeof value === "string") return base64ToBytes(value);
  throw new Error("expected byte payload");
}
