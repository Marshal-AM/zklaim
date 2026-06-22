import { buildAspTreeArtifact } from "./tree_utils.js";

buildAspTreeArtifact()
  .then((tree) => {
    console.log(JSON.stringify(tree, null, 2));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
