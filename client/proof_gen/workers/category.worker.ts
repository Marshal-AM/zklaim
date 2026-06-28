import { proveCategoryNonMembershipCircuit } from "../circuits.js";
import type { WorkerProveMessage, WorkerResponse } from "../inputs.js";

self.onmessage = async (e: MessageEvent<WorkerProveMessage>) => {
  try {
    if (e.data.type !== "PROVE" || e.data.circuit !== "category_nonmembership") {
      throw new Error("Invalid worker message");
    }
    const result = await proveCategoryNonMembershipCircuit(
      e.data.inputs as Parameters<typeof proveCategoryNonMembershipCircuit>[0],
    );
    const msg: WorkerResponse = { type: "PROOF", result };
    self.postMessage(msg);
  } catch (err) {
    const msg: WorkerResponse = {
      type: "ERROR",
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(msg);
  }
};
