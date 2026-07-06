import "server-only";
import { MongoClient } from "mongodb";
import { env } from "@/lib/env";

// A raw MongoClient (separate from the Mongoose connection) is required by
// @next-auth/mongodb-adapter, which talks to the driver directly. It's kept
// ready for OAuth providers later; the Credentials flow below manages the
// `User` collection directly via the Mongoose model and never touches this.
declare global {
  // eslint-disable-next-line no-var -- `var` is required in ambient global declarations
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(env.MONGODB_URI).connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = new MongoClient(env.MONGODB_URI).connect();
}

export default clientPromise;
