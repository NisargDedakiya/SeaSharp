import { beforeAll, afterAll, afterEach } from "vitest";
import { connectTestDb, disconnectTestDb, clearTestDb } from "./db";

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await clearTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});
