import mongoose from "mongoose";

export async function connectTestDb() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }
}

export async function disconnectTestDb() {
  await mongoose.disconnect();
}

export async function clearTestDb() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

// FerretDB (used as a local wire-protocol stand-in where downloading a real
// mongod binary isn't possible) doesn't support multi-document transactions.
// Real MongoDB and mongodb-memory-server's replica set both do. Tests that
// assert transactional rollback behavior should skip when this is false.
export async function transactionsSupported(): Promise<boolean> {
  const session = await mongoose.startSession();
  try {
    let ok = true;
    await session.withTransaction(async () => {
      await mongoose.connection.db!.collection("__tx_probe__").insertOne({ ok: 1 }, { session });
    });
    await mongoose.connection.db!.collection("__tx_probe__").deleteMany({});
    return ok;
  } catch {
    return false;
  } finally {
    await session.endSession();
  }
}
