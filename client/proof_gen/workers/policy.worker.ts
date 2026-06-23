import { runProveJob } from "./prove_shared.js";
import type { WorkerProveMessage, WorkerResponse } from "../inputs.js";

self.onmessage = async (event: MessageEvent<WorkerProveMessage>) => {
  const msg = event.data;
  if (msg.type !== "PROVE") return;
  try {
    const result = await runProveJob(msg.circuit, msg.inputs);
    const response: WorkerResponse = { type: "PROOF", result };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerResponse = {
      type: "ERROR",
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
