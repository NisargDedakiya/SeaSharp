import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["./tsconfig.vitest.json"] })],
  resolve: {
    // The `server-only` package (used to fence Mongoose/DB code out of
    // client bundles) resolves to a no-op only when the "react-server"
    // export condition is active; without it, plain Node throws on import.
    // Next.js's build sets this condition automatically — tests need it too.
    // Vitest runs tests through Vite's SSR pipeline, which resolves
    // externalized node_modules deps via `ssr.resolve` rather than the
    // plain `resolve` block, so the condition needs to be set in both.
    conditions: ["react-server"],
  },
  ssr: {
    resolve: {
      conditions: ["react-server"],
      externalConditions: ["react-server"],
    },
  },
  test: {
    // Worker threads don't reliably re-apply NODE_OPTIONS (e.g. the
    // --conditions flag `server-only` needs) the way real child processes
    // do — use forks so that flag actually takes effect in test workers.
    pool: "forks",
    environment: "node",
    env: {
      NEXTAUTH_SECRET: "test-secret-test-secret-test-secret-1234",
      NEXTAUTH_URL: "http://localhost:3000",
      NODE_ENV: "test",
    },
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
