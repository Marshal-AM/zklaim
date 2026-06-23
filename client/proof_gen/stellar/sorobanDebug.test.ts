import { describe, expect, it } from "vitest";
import {
  BASE_FEE,
  Networks,
  Operation,
  TransactionBuilder,
  Account,
} from "@stellar/stellar-sdk";
import { snapshotSorobanTx } from "./sorobanDebug.js";

describe("sorobanDebug", () => {
  it("flags fee equation mismatch on inflated classic fee", () => {
    const account = new Account(
      "GAQ5S6CJWD5K4SAKNSYUEOAB7FT2JFUJY4XSZWKODS2NLHMN3IS467O6",
      "1",
    );
    const unsigned = new TransactionBuilder(account, {
      fee: "2000000",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.invokeContractFunction({
          contract:
            "CBRFFLN5NWWAZSULYUO6MHNLA7L4HAYXBHHLNPE4M7OP3RRD2ZAMQPND",
          function: "submit_claim",
          args: [],
        }),
      )
      .setTimeout(30)
      .build();

    const snap = snapshotSorobanTx(unsigned, "test");
    expect(snap.fee).toBe("2000000");
    expect(snap.hasSorobanExt).toBe(false);
    expect(snap.problems.some((p) => p.includes("missing Soroban"))).toBe(
      true,
    );
  });

  it("uses network base fee constant", () => {
    expect(BASE_FEE).toBe("100");
  });
});
