import { describe, expect, it } from "vitest";
import {
  isRetryableSubmitError,
  isSorobanMetadataExpiredError,
} from "./errors.js";

describe("submit errors", () => {
  it("detects Soroban metadata expiry", () => {
    expect(
      isSorobanMetadataExpiredError(
        "sendTransaction failed: txSorobanInvalid (fee charged: 100 stroops)",
      ),
    ).toBe(true);
  });

  it("treats txMalformed as retryable", () => {
    expect(
      isRetryableSubmitError(
        "sendTransaction failed: txMalformed (fee charged: 998016 stroops)",
      ),
    ).toBe(true);
  });
});
