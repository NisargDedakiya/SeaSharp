import type { MongoMemoryReplSet } from "mongodb-memory-server";

// If MONGODB_URI is already set (e.g. pointing at a real MongoDB, or at a
// wire-protocol-compatible dev server), reuse it. Otherwise spin up an
// ephemeral single-node replica set via mongodb-memory-server — this is the
// path CI and most local dev machines take, since it needs to download a
// real mongod binary the first time. `setup` and `teardown` run in the same
// process, so a module-scoped variable is enough to hand the instance off.
let replSet: MongoMemoryReplSet | undefined;

export async function setup() {
  // Pick up a local .env (e.g. MONGODB_URI pointing at a dev-time FerretDB
  // instance) if present, without requiring it — CI has no .env file and
  // falls through to mongodb-memory-server below.
  try {
    process.loadEnvFile(".env");
  } catch {
    // no .env file — fine, CI provides MONGODB_URI itself or we spin one up
  }

  if (process.env.MONGODB_URI) {
    // Redirect to a dedicated test database so the suite's aggressive
    // collection-clearing (see tests/db.ts) never touches dev data sitting
    // in the same MongoDB/FerretDB instance.
    const url = new URL(process.env.MONGODB_URI);
    url.pathname = "/seasharp-test";
    process.env.MONGODB_URI = url.toString();
    return;
  }

  const { MongoMemoryReplSet } = await import("mongodb-memory-server");
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  // getUri(dbName) inserts the database name as a path segment ahead of the
  // `?replicaSet=...` query string. Naively concatenating a db name onto the
  // end of getUri()'s return value instead corrupts the replicaSet query
  // param itself (e.g. "replicaSet=testset" + "seasharp-test" collapses into
  // the single bogus set name "testsetseasharp-test"), which is why this
  // used to hang for the full server-selection timeout instead of failing
  // fast.
  process.env.MONGODB_URI = replSet.getUri("seasharp-test");
}

export async function teardown() {
  if (replSet) await replSet.stop();
}
