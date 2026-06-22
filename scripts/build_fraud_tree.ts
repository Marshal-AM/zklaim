import { buildFraudTreeArtifact } from "./tree_utils.js";

buildFraudTreeArtifact()
  .then((tree) => {
    console.log(JSON.stringify(tree, null, 2));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
