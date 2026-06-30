#!/usr/bin/env node
/**
 * Generate NaCl box keypair for insurer selective-disclosure (view key).
 * Usage: node scripts/generate_insurer_view_keys.mjs [--write-env]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../app/package.json"));
const nacl = require("tweetnacl");
const { encodeBase64 } = require("tweetnacl-util");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const writeEnv = process.argv.includes("--write-env");

const kp = nacl.box.keyPair();
const publicKey = encodeBase64(kp.publicKey);
const secretKey = encodeBase64(kp.secretKey);

console.log("=== Insurer view keypair (NaCl box) ===\n");
console.log(`VITE_INSURER_VIEW_PUBLIC_KEY=${publicKey}`);
console.log(`VITE_INSURER_VIEW_SECRET_KEY=${secretKey}`);
console.log("\nPublic key → encrypt envelopes when providers create claims.");
console.log("Secret key → Admin → Insurer audit (demo: via VITE_ env or paste in UI).");
console.log("Never commit the secret key to git.\n");

if (writeEnv) {
  const envPath = join(ROOT, ".env");
  let body = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const lines = body.split("\n").filter(
    (l) =>
      !l.startsWith("VITE_INSURER_VIEW_PUBLIC_KEY=") &&
      !l.startsWith("VITE_INSURER_VIEW_SECRET_KEY="),
  );
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  lines.push(
    "",
    "# Insurer selective-disclosure (view key) — demo local only",
    `VITE_INSURER_VIEW_PUBLIC_KEY=${publicKey}`,
    `VITE_INSURER_VIEW_SECRET_KEY=${secretKey}`,
    "",
  );
  writeFileSync(envPath, lines.join("\n"));
  console.log(`Updated ${envPath}`);
}
