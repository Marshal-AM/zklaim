/** Dev logging for Freighter integration (open browser DevTools → Console). */

const PREFIX = "[ZKlaim Freighter]";

function enabled(): boolean {
  return (
    import.meta.env.DEV ||
    import.meta.env.VITE_FREIGHTER_DEBUG === "true"
  );
}

export function freighterLog(label: string, data?: unknown): void {
  if (!enabled()) return;
  if (data !== undefined) {
    console.log(PREFIX, label, data);
  } else {
    console.log(PREFIX, label);
  }
}

export function freighterLogError(label: string, err: unknown): void {
  if (!enabled()) return;
  console.error(PREFIX, label, err);
}

export function describeFreighterValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    return `string(len=${value.length}) preview=${JSON.stringify(value.slice(0, 80))}`;
  }
  if (typeof value === "object") {
    try {
      return `object keys=[${Object.keys(value as object).join(",")}] ${JSON.stringify(value).slice(0, 300)}`;
    } catch {
      return `object(${Object.prototype.toString.call(value)})`;
    }
  }
  return `${typeof value} ${String(value)}`;
}

/** Freighter signBlob expects base64-encoded payload (extension 5.2+). */
export function encodeBlobForFreighter(plainText: string): string {
  const bytes = new TextEncoder().encode(plainText);
  return bytesToBase64(bytes);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** Freighter v2 + modern extension may return Buffer / Uint8Array signatures. */
export function normalizeSignatureToBase64(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  const bytes = coalesceSignatureBytes(value);
  if (bytes && bytes.length > 0) {
    return bytesToBase64(bytes);
  }

  return null;
}

function coalesceSignatureBytes(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (record.type === "Buffer" && Array.isArray(record.data)) {
      return new Uint8Array(record.data as number[]);
    }

    if (Array.isArray(record.data) && record.data.every((n) => typeof n === "number")) {
      return new Uint8Array(record.data as number[]);
    }
  }

  return null;
}

export function parseSignBlobResult(raw: unknown): string {
  freighterLog("signBlob raw response", describeFreighterValue(raw));

  if (typeof raw === "string" && raw.length === 0) {
    throw new Error(
      "Freighter returned an empty signature. Approve the Freighter popup, or confirm the signing account matches your connected wallet.",
    );
  }

  const direct = normalizeSignatureToBase64(raw);
  if (direct) {
    freighterLog("signBlob signature (direct)", {
      encoding: "base64",
      byteLength: coalesceSignatureBytes(raw)?.length ?? "n/a",
      preview: direct.slice(0, 24),
    });
    return direct;
  }

  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const candidates = [
      "signedBlob",
      "signature",
      "signedMessage",
      "signedPayload",
    ];
    for (const key of candidates) {
      const normalized = normalizeSignatureToBase64(record[key]);
      if (normalized) {
        freighterLog(`signBlob signature from field ${key}`, {
          encoding: "base64",
          preview: normalized.slice(0, 24),
        });
        return normalized;
      }
    }
    const err = record.error;
    if (err) {
      if (typeof err === "string") throw new Error(err);
      if (typeof err === "object" && err && "message" in err) {
        throw new Error(String((err as { message: unknown }).message));
      }
      throw new Error(JSON.stringify(err));
    }
  }

  throw new Error(
    `Freighter did not return a signature (${describeFreighterValue(raw)}). Check the console for [ZKlaim Freighter] logs.`,
  );
}

export function parseSignTransactionResult(raw: unknown): string {
  freighterLog("signTransaction raw response", describeFreighterValue(raw));

  if (typeof raw === "string" && raw.length > 0) return raw;

  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    const xdr =
      record.signedTransaction ??
      record.signedTxXdr ??
      record.signedXdr;
    if (typeof xdr === "string" && xdr.length > 0) return xdr;
    if (record.error) {
      throw new Error(JSON.stringify(record.error));
    }
  }

  throw new Error(
    `Freighter did not return a signed transaction (${describeFreighterValue(raw)})`,
  );
}
