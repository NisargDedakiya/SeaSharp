import { afterEach } from "vitest";
import { clearTestDb } from "./db";

afterEach(async () => {
  await clearTestDb();
});
