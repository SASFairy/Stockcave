import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// SQLite WAL (Write-Ahead Logging) mode activation
// This prevents database locks during concurrent reads/writes.
async function enableWAL() {
  try {
    await prisma.$queryRawUnsafe(`PRAGMA journal_mode=WAL;`);
    await prisma.$queryRawUnsafe(`PRAGMA busy_timeout=5000;`);
  } catch (error) {
    console.error("Failed to enable WAL mode in SQLite:", error);
  }
}

enableWAL();
