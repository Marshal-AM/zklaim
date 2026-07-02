#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "app", "public");

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function copyRequired(src, dest) {
  if (!existsSync(src)) {
    console.error(`Missing required asset: ${src}`);
    console.error(
      "Run npm run build:trees first (trees are generated, not committed).",
    );
    process.exit(1);
  }
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
  console.log(`  ${dest.replace(ROOT, ".")}`);
}

function copyDirJson(srcDir, destDir) {
  ensureDir(destDir);
  if (!existsSync(srcDir)) {
    console.error(`Missing directory: ${srcDir}`);
    process.exit(1);
  }
  for (const file of readdirSync(srcDir).filter((f) => f.endsWith(".json"))) {
    copyRequired(join(srcDir, file), join(destDir, file));
  }
}

console.log("=== Syncing app/public assets ===");

ensureDir(join(PUBLIC, "trees"));
ensureDir(join(PUBLIC, "seed"));
ensureDir(join(PUBLIC, "wasm"));

for (const name of ["policy_tree", "asp_tree", "fraud_tree", "manifest"]) {
  copyRequired(
    join(ROOT, "scripts", "artifacts", `${name}.json`),
    join(PUBLIC, "trees", `${name}.json`),
  );
}

for (const name of ["demo_claim", "covered_ranges", "physicians"]) {
  copyRequired(
    join(ROOT, "scripts", "seed", `${name}.json`),
    join(PUBLIC, "seed", `${name}.json`),
  );
}

const wasmCandidates = [
  join(ROOT, "client", "proof_gen", "wasm"),
  join(ROOT, "client", "wasm"),
];
const wasmSrc = wasmCandidates.find((p) => existsSync(p));
if (wasmSrc) {
  copyDirJson(wasmSrc, join(PUBLIC, "wasm"));
} else {
  console.warn(
    "WARN: Missing circuit WASM — run npm run build:circuits in WSL for browser proving",
  );
}

console.log("=== App assets synced ===");
