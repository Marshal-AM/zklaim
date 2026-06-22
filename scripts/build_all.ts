import { writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPolicyTreeArtifact,
  buildAspTreeArtifact,
  buildFraudTreeArtifact,
  ARTIFACTS,
} from "./tree_utils.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

async function main() {
  mkdirSync(ARTIFACTS, { recursive: true });

  console.log("Building policy coverage tree...");
  const policyTree = await buildPolicyTreeArtifact();
  writeFileSync(
    join(ARTIFACTS, "policy_tree.json"),
    JSON.stringify(policyTree, null, 2),
  );

  console.log("Building doctor ASP tree...");
  const aspTree = await buildAspTreeArtifact();
  writeFileSync(
    join(ARTIFACTS, "asp_tree.json"),
    JSON.stringify(aspTree, null, 2),
  );

  console.log("Building fraud sparse Merkle tree...");
  const fraudTree = await buildFraudTreeArtifact();
  writeFileSync(
    join(ARTIFACTS, "fraud_tree.json"),
    JSON.stringify(fraudTree, null, 2),
  );

  const demoDoctor = aspTree.doctors.find((d) => d.license_id === "MD-001");

  const manifest = {
    generated_at: new Date().toISOString(),
    merkle_depth: policyTree.depth,
    roots: {
      policy_coverage: policyTree.root,
      physician_asp: aspTree.root,
      fraud_asp: fraudTree.root,
    },
    demo: {
      icd_code: "J18.9",
      enrolled_doctor_wallet: demoDoctor?.wallet_address,
      unenrolled_doctor_wallet: aspTree.unenrolled_wallet,
      deductible_demo_threshold_cents: 100000,
    },
  };

  writeFileSync(
    join(ARTIFACTS, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  const publicTrees = join(ROOT, "app", "public", "trees");
  mkdirSync(publicTrees, { recursive: true });
  for (const file of ["policy_tree.json", "asp_tree.json", "fraud_tree.json", "manifest.json"]) {
    cpSync(join(ARTIFACTS, file), join(publicTrees, file));
  }

  console.log("");
  console.log("Artifacts written to scripts/artifacts/ and app/public/trees/");
  console.log("Policy root:", policyTree.root);
  console.log("ASP root:   ", aspTree.root);
  console.log("Fraud root: ", fraudTree.root);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
