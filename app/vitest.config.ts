import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, ".."),
  envPrefix: "VITE_",
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
