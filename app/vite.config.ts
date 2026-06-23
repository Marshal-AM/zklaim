import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const ROOT = path.resolve(__dirname, "..");

export default defineConfig({
  plugins: [react()],
  envDir: ROOT,
  envPrefix: "VITE_",
  server: {
    port: 5173,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    fs: {
      allow: [ROOT, path.resolve(__dirname, "node_modules")],
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["@aztec/bb.js", "@noir-lang/noir_js"],
  },
  assetsInclude: ["**/*.json"],
  build: {
    rollupOptions: {
      external: [
        "./circuits_node.js",
        "./fraud_node.js",
        "../client/proof_gen/circuits_node.ts",
        "../client/proof_gen/fraud_node.ts",
      ],
    },
  },
  resolve: {
    dedupe: ["@stellar/stellar-sdk", "@stellar/stellar-base"],
    alias: {
      "@zklaim/proof-gen": path.resolve(ROOT, "client/proof_gen"),
    },
  },
});
