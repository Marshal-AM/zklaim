import { describe, expect, it } from "vitest";
import {
  encodeBlobForFreighter,
  parseSignBlobResult,
  parseSignMessageResult,
  parseSignTransactionResult,
  bytesToBase64,
} from "./freighterDebug";

describe("freighterDebug", () => {
  it("base64-encodes claim payload for signBlob", () => {
    const plain = '{"icd_code":"J18.9"}';
    const encoded = encodeBlobForFreighter(plain);
    expect(encoded).toBe(btoa(plain));
  });

  it("parses string signBlob result", () => {
    expect(parseSignBlobResult("abc123")).toBe("abc123");
  });

  it("parses object signBlob result", () => {
    expect(parseSignBlobResult({ signedBlob: "sig" })).toBe("sig");
  });

  it("parses Buffer-shaped signBlob result from Freighter", () => {
    const bytes = new Uint8Array(64).fill(7);
    const result = parseSignBlobResult({
      type: "Buffer",
      data: Array.from(bytes),
    });
    expect(result).toBe(bytesToBase64(bytes));
  });

  it("throws on empty string with helpful message", () => {
    expect(() => parseSignBlobResult("")).toThrow(/empty signature/i);
  });

  it("parses v3 signMessage object with signedMessage string", () => {
    expect(parseSignMessageResult({ signedMessage: "sig-base64", signerAddress: "G..." })).toBe(
      "sig-base64",
    );
  });

  it("parses v3 signMessage object with Buffer-shaped signedMessage", () => {
    const bytes = new Uint8Array(64).fill(7);
    const result = parseSignMessageResult({
      signedMessage: { type: "Buffer", data: Array.from(bytes) },
      signerAddress: "G...",
    });
    expect(result).toBe(bytesToBase64(bytes));
  });

  it("parses signedTxXdr from object signTransaction result", () => {
    expect(parseSignTransactionResult({ signedTxXdr: "signed-xdr" })).toBe(
      "signed-xdr",
    );
  });

  it("throws Freighter error from signTransaction result", () => {
    expect(() =>
      parseSignTransactionResult({ error: "User declined access" }),
    ).toThrow(/Freighter error: User declined access/);
  });
});
