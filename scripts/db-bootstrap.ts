// Applies the hand-written SQL in drizzle/manual/ (roles, auth.uid(),
// RLS policies, system role/permission seed data) against DATABASE_URL,
// in filename order. Run once after `npm run db:migrate`, and again any
// time a new file is added to drizzle/manual/. See docs/04-database-design.md.
import "dotenv/config";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

async function main() {
  const dir = join(__dirname, "..", "drizzle", "manual");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  try {
    for (const file of files) {
      const content = readFileSync(join(dir, file), "utf8");
      console.log(`Applying ${file}...`);
      await sql.unsafe(content);
    }
    console.log(`Applied ${files.length} manual SQL file(s).`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
