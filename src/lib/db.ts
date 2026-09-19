import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "@/lib/prisma-client";

// Next.js dev server hot-reloads modules, which would otherwise open a new
// connection on every edit until the driver refuses more.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
