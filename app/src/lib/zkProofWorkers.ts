import type { CircuitName } from "@zklaim/proof-gen";
import PolicyWorker from "../../../client/proof_gen/workers/policy.worker.ts?worker";
import AmountWorker from "../../../client/proof_gen/workers/amount.worker.ts?worker";
import DoctorWorker from "../../../client/proof_gen/workers/doctor.worker.ts?worker";
import AccumWorker from "../../../client/proof_gen/workers/accum.worker.ts?worker";
import CategoryWorker from "../../../client/proof_gen/workers/category.worker.ts?worker";

export type ZkProofWorkerConstructor = new () => Worker;

/** Vite-bundled module workers (must be imported from the app package, not proof-gen). */
export const zkProofWorkerConstructors: Record<CircuitName, ZkProofWorkerConstructor> =
  {
    policy_validity: PolicyWorker,
    amount_range: AmountWorker,
    doctor_attestation: DoctorWorker,
    deductible_accumulator: AccumWorker,
    category_nonmembership: CategoryWorker,
  };
