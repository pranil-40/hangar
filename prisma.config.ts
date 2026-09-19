import path from "node:path";
import { defineConfig, env } from "prisma/config";

// Prisma 7 does not read .env by itself (Next.js does, for the running app).
// process.loadEnvFile is built into Node 20.6+, so this needs no dependency.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // No .env — fall back to the ambient environment (CI, hosting provider).
}

// The CLI (db push, studio, seed) reads the connection URL from here;
// the running app gets it from the driver adapter in src/lib/db.ts.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
