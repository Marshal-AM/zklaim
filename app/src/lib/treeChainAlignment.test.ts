import { describe, expect, it } from "vitest";
import { formatTreeAlignmentError } from "./treeChainAlignment";
import { normalizeRootHex } from "./sorobanRead";

describe("treeChainAlignment", () => {
  it("formats actionable misalignment errors", () => {
    const msg = formatTreeAlignmentError({
      aligned: false,
      manifestGeneratedAt: "2026-01-01T00:00:00.000Z",
      artifactRoots: {
        policy: "aa".repeat(32),
        asp: "bb".repeat(32),
        fraud: "cc".repeat(32),
        aspDoctorCount: 3,
      },
      onChainRoots: {
        policy: "aa".repeat(32),
        asp: "dd".repeat(32),
        fraud: "cc".repeat(32),
        aspLeafCount: 4,
      },
      mismatches: [
        {
          label: "Physician ASP root",
          expected: "bb".repeat(32),
          actual: "dd".repeat(32),
        },
        {
          label: "ASP enrolled doctor count",
          expected: "3",
          actual: "4",
        },
      ],
    });
    expect(msg).toContain("Physician ASP root");
    expect(msg).toContain("redeploy:asp-escrow");
  });
});

describe("normalizeRootHex", () => {
  it("strips 0x and lowercases", () => {
    expect(normalizeRootHex("0xAb" + "0".repeat(62))).toBe(
      "ab" + "0".repeat(62),
    );
  });
});
