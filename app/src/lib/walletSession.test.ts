import { beforeEach, describe, expect, it, vi } from "vitest";
import { connectFreighter, getFreighterAddress } from "./freighter";
import { ensureWalletConnected, ensureAdminWalletConnected } from "./walletSession";
import {
  clearWalletSessionSuppressed,
  markWalletSessionDisconnected,
} from "./walletPersistence";
import { useWalletStore } from "../store/wallet";

vi.mock("./freighter", () => ({
  connectFreighter: vi.fn(),
  getFreighterAddress: vi.fn(),
}));

vi.mock("../config/env", () => ({
  env: {
    adminAddress: () => "GADMIN_FROM_ENV",
  },
}));

describe("ensureWalletConnected", () => {
  beforeEach(() => {
    clearWalletSessionSuppressed();
    useWalletStore.setState({
      address: null,
      connected: false,
      usdcBalance: null,
      hydrated: false,
    });
    vi.mocked(connectFreighter).mockReset();
    vi.mocked(getFreighterAddress).mockReset();
    vi.mocked(getFreighterAddress).mockResolvedValue(null);
  });

  it("returns the in-app session without calling Freighter", async () => {
    useWalletStore.setState({
      address: "GABC123",
      connected: true,
      usdcBalance: "1.00",
    });

    await expect(ensureWalletConnected()).resolves.toBe("GABC123");
    expect(connectFreighter).not.toHaveBeenCalled();
    expect(getFreighterAddress).not.toHaveBeenCalled();
  });

  it("silently reuses Freighter when already allowed", async () => {
    vi.mocked(getFreighterAddress).mockResolvedValue("GALLOWED");

    await expect(ensureWalletConnected()).resolves.toBe("GALLOWED");
    expect(getFreighterAddress).toHaveBeenCalledOnce();
    expect(connectFreighter).not.toHaveBeenCalled();
    expect(useWalletStore.getState().address).toBe("GALLOWED");
  });

  it("prompts Freighter when not allowed and session not suppressed", async () => {
    vi.mocked(connectFreighter).mockResolvedValue("GNEW456");

    await expect(ensureWalletConnected()).resolves.toBe("GNEW456");
    expect(connectFreighter).toHaveBeenCalledOnce();
    expect(useWalletStore.getState().address).toBe("GNEW456");
  });

  it("skips silent Freighter sync after explicit sign out", async () => {
    markWalletSessionDisconnected();
    vi.mocked(getFreighterAddress).mockResolvedValue("GALLOWED");
    vi.mocked(connectFreighter).mockResolvedValue("GNEW456");

    await expect(ensureWalletConnected()).resolves.toBe("GNEW456");
    expect(getFreighterAddress).not.toHaveBeenCalled();
    expect(connectFreighter).toHaveBeenCalledOnce();
  });
});

describe("ensureAdminWalletConnected", () => {
  beforeEach(() => {
    clearWalletSessionSuppressed();
    useWalletStore.setState({
      address: null,
      connected: false,
      usdcBalance: null,
      hydrated: false,
    });
  });

  it("returns env admin when Freighter matches", async () => {
    useWalletStore.setState({
      address: "GADMIN_FROM_ENV",
      connected: true,
      usdcBalance: "1.00",
    });
    await expect(ensureAdminWalletConnected()).resolves.toBe("GADMIN_FROM_ENV");
  });

  it("rejects when connected wallet is not env admin", async () => {
    useWalletStore.setState({
      address: "GPATIENT",
      connected: true,
      usdcBalance: "1.00",
    });
    await expect(ensureAdminWalletConnected()).rejects.toThrow(/GADMIN_FROM_ENV/);
  });
});

describe("hydrateFromFreighter", () => {
  beforeEach(() => {
    clearWalletSessionSuppressed();
    useWalletStore.setState({
      address: null,
      connected: false,
      usdcBalance: null,
      hydrated: false,
    });
    vi.mocked(getFreighterAddress).mockReset();
  });

  it("restores address on reload when Freighter already allowed", async () => {
    vi.mocked(getFreighterAddress).mockResolvedValue("GRELOAD");

    await useWalletStore.getState().hydrateFromFreighter();

    expect(useWalletStore.getState().connected).toBe(true);
    expect(useWalletStore.getState().address).toBe("GRELOAD");
  });

  it("does not restore after explicit sign out", async () => {
    markWalletSessionDisconnected();
    vi.mocked(getFreighterAddress).mockResolvedValue("GRELOAD");

    await useWalletStore.getState().hydrateFromFreighter();

    expect(useWalletStore.getState().connected).toBe(false);
    expect(getFreighterAddress).not.toHaveBeenCalled();
  });
});
