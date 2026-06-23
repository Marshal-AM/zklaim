import { describe, expect, it, vi } from "vitest";
import { opfsReadJson, opfsWriteJson } from "./opfs";

describe("opfs", () => {
  it("reads and writes json via mock storage", async () => {
    const files = new Map<string, string>();
    const mockHandle = {
      getFile: async () => ({
        text: async () => files.get("test.json") ?? "",
      }),
      createWritable: async () => {
        let content = "";
        return {
          write: async (data: string) => {
            content = data;
          },
          close: async () => {
            files.set("test.json", content);
          },
        };
      },
    };

    vi.stubGlobal("navigator", {
      storage: {
        getDirectory: async () => ({
          getDirectoryHandle: async () => ({
            getFileHandle: async () => mockHandle,
          }),
        }),
      },
    });

    await opfsWriteJson("test.json", { hello: "world" });
    const data = await opfsReadJson<{ hello: string }>("test.json");
    expect(data?.hello).toBe("world");
    vi.unstubAllGlobals();
  });
});
