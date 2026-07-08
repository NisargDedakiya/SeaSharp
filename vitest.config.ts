import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths({ projects: ["./tsconfig.vitest.json"] })],
  resolve: {
    // The `server-only` package (used to fence Mongoose/DB code out of
    // client bundles) resolves to a no-op only when the "react-server"
    // export condition is active; without it, plain Node throws on import.
    // Next.js's build sets this condition automatically for its own module
    // graph. We used to flip on that same condition globally for Vitest,
    // but as of Next.js 15 (React 18.3.1), React's own package.json also
    // defines a "react-server" export condition, which points "react" at
    // react.shared-subset.js — a restricted build that throws ("This entry
    // point is not yet supported outside of experimental channels") the
    // moment anything in the test's import graph (here, route handlers
    // importing next/server) does a plain `require("react")`. Route-handler
    // tests need real `react`, not the shared subset, so instead of the
    // global condition we alias `server-only` straight to its no-op export.
    alias: {
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    // Worker threads don't reliably re-apply NODE_OPTIONS (e.g. the
    // --conditions flag `server-only` needs) the way real child processes
    // do — use forks so that flag actually takes effect in test workers.
    pool: "forks",
    environment: "node",
    env: {
      AUTH_JWT_SECRET: "test-secret-test-secret-test-secret-1234",
      APP_URL: "http://localhost:3000",
      NODE_ENV: "test",
    },
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
