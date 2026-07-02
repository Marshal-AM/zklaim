import { beforeAll } from "vitest";
import { ensureNodeProofGenInitialized } from "./nodeInit.js";

beforeAll(() => {
  ensureNodeProofGenInitialized();
});
