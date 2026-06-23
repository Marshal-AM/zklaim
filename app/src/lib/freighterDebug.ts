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

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
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

/** Freighter v3+ may return Buffer / Uint8Array signatures. */
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

export function formatFreighterError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    if ("message" in error) {
      return String((error as { message: unknown }).message);
    }
    if ("code" in error) {
      return JSON.stringify(error);
    }
  }
  return JSON.stringify(error);
}

export function parseSignAuthEntryResult(raw: {
  signedAuthEntry: unknown;
  error?: unknown;
}): Uint8Array {
  freighterLog("signAuthEntry raw response", describeFreighterValue(raw));

  if (raw.error) {
    throw new Error(`Freighter error: ${formatFreighterError(raw.error)}`);
  }

  const bytes = coalesceSignatureBytes(raw.signedAuthEntry);
  if (!bytes || bytes.length === 0) {
    throw new Error(
      "Freighter returned an empty auth signature. Approve the auth entry prompt and retry.",
    );
  }

  return bytes;
}

export function parseSignMessageResult(raw: unknown): string {
  freighterLog("signMessage raw response", describeFreighterValue(raw));

  if (typeof raw === "string" && raw.length === 0) {
    throw new Error(
      "Freighter returned an empty signature. Approve the Freighter popup, or confirm the signing account matches your connected wallet.",
    );
  }

  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (record.error) {
      throw new Error(`Freighter error: ${formatFreighterError(record.error)}`);
    }
    const candidates = [
      record.signedMessage,
      record.signedBlob,
      record.signature,
      record.signedPayload,
    ];
    for (const candidate of candidates) {
      const normalized = normalizeSignatureToBase64(candidate);
      if (normalized) {
        return normalized;
      }
    }
  }

  const direct = normalizeSignatureToBase64(raw);
  if (direct) return direct;

  throw new Error(
    `Freighter did not return a signature (${describeFreighterValue(raw)}). Check the console for [ZKlaim Freighter] logs.`,
  );
}

/** @deprecated v3 uses signMessage; kept for tests. */
export function encodeBlobForFreighter(plainText: string): string {
  const bytes = new TextEncoder().encode(plainText);
  return bytesToBase64(bytes);
}

/** @deprecated v3 uses parseSignMessageResult. */
export function parseSignBlobResult(raw: unknown): string {
  return parseSignMessageResult(raw);
}

export function parseSignTransactionResult(raw: unknown): string {
  freighterLog("signTransaction raw response", describeFreighterValue(raw));

  if (typeof raw === "string" && raw.length > 0) return raw;

  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (record.error) {
      throw new Error(`Freighter error: ${formatFreighterError(record.error)}`);
    }
    const xdr =
      record.signedTxXdr ??
      record.signedTransaction ??
      record.signedXdr;
    if (typeof xdr === "string" && xdr.length > 0) return xdr;
  }

  throw new Error(
    `Freighter did not return a signed transaction (${describeFreighterValue(raw)})`,
  );
}
