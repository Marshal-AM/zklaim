import { xdr } from "@stellar/stellar-sdk";

const RESULT_CODES: Record<number, string> = {
  [-17]: "txSorobanInvalid (Soroban metadata expired or invalid — retry submit)",
  [-16]: "txNotSupported",
  [-15]: "txFeeBumpInnerFailed",
  [-14]: "txBadSeq",
  [-13]: "txInsufficientFee",
  [-12]: "txNoAccount",
  [-11]: "txInsufficientBalance",
  [-10]: "txInternalError",
  [-9]: "txFailed",
  [-8]: "txTooEarly",
  [-7]: "txTooLate",
  [-6]: "txMissingOperation",
  [-5]: "txBadAuth",
  [-4]: "txBadAuthExtra",
  [-3]: "txMalformed",
};

export function isSorobanMetadataExpiredError(message: string): boolean {
  return (
    message.includes("txSorobanInvalid") ||
    message.includes("Soroban metadata expired")
  );
}

/** Transient submit errors that usually succeed on a fresh simulate → sign → send. */
export function isRetryableSubmitError(message: string): boolean {
  return (
    isSorobanMetadataExpiredError(message) || message.includes("txMalformed")
  );
}

export function decodeSubmitErrorXdr(xdrBase64: string | undefined): string {
  if (!xdrBase64) return "unknown submit error";
  try {
    const result = xdr.TransactionResult.fromXDR(xdrBase64, "base64");
    const code = result.result().switch().value;
    const label =
      RESULT_CODES[code] ?? `transaction result code ${code}`;
    const fee = result.feeCharged().toString();
    return `${label} (fee charged: ${fee} stroops)`;
  } catch {
    return xdrBase64;
  }
}
