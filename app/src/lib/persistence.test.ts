import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  loadPatientPersistence,
  migrateLegacyPatientData,
  savePatientIdentity,
} from "./persistence";
import { LEGACY_PATIENT_OPFS_KEYS } from "./patientWalletScope";

const WALLET = "GBEQTRDIJYZPZG6OUIILUE5Z57RLMAWDF63BDAXENFD3CHP2XU2EYC7A";

function mockOpfs() {
  const files = new Map<string, string>();
  const mockHandle = (name: string) => ({
    getFile: async () => ({
      text: async () => files.get(name) ?? "",
    }),
    createWritable: async () => {
      let content = "";
      return {
        write: async (data: string) => {
          content = data;
        },
        close: async () => {
          files.set(name, content);
        },
      };
    },
  });

  vi.stubGlobal("navigator", {
    storage: {
      getDirectory: async () => ({
        getDirectoryHandle: async () => ({
          getFileHandle: async (name: string, opts?: { create?: boolean }) => {
            if (!files.has(name) && !opts?.create) {
              throw new Error("not found");
            }
            return mockHandle(name);
          },
          removeEntry: async (name: string) => {
            files.delete(name);
          },
        }),
      }),
    },
  });

  return files;
}

describe("per-wallet persistence", () => {
  beforeEach(() => {
    mockOpfs();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores identity separately per wallet", async () => {
    const identityA = {
      policy_secret: "0x01",
      diagnosis_secret: "0x02",
      box_public_key: "pk",
      box_secret_key: "sk",
      deductible_limit_cents: 100_000,
      accumulator_met_cents: 0,
      policy_id: "DEMO",
      stellar_address: WALLET,
    };

    await savePatientIdentity(identityA, WALLET);
    const loaded = await loadPatientPersistence(WALLET);
    expect(loaded.identity?.stellar_address).toBe(WALLET);
    expect(loaded.identity?.accumulator_met_cents).toBe(0);
  });

  it("migrates legacy global identity to matching wallet only", async () => {
    const files = mockOpfs();
    files.set(
      LEGACY_PATIENT_OPFS_KEYS.identity,
      JSON.stringify({
        policy_secret: "0x01",
        diagnosis_secret: "0x02",
        box_public_key: "pk",
        box_secret_key: "sk",
        deductible_limit_cents: 100_000,
        accumulator_met_cents: 50_000,
        policy_id: "DEMO",
        stellar_address: WALLET,
      }),
    );
    files.set(
      LEGACY_PATIENT_OPFS_KEYS.inbox,
      JSON.stringify([{ id: "c1", status: "pending" }]),
    );

    await migrateLegacyPatientData(WALLET);
    const loaded = await loadPatientPersistence(WALLET);
    expect(loaded.identity?.accumulator_met_cents).toBe(50_000);
    expect(loaded.inbox).toHaveLength(1);
    expect(files.has(LEGACY_PATIENT_OPFS_KEYS.identity)).toBe(false);
  });
});
