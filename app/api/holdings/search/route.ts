import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || "";

    if (!query || query.length < 1) {
      return NextResponse.json([]);
    }

    const containsPattern = `%${query}%`;

    // High-performance SQLite custom sorting search:
    // Treats exact, prefix, and substring matches equally (all within containsPattern).
    // Sorted strictly by:
    // 1. holderCount DESC (most family members holding first)
    // 2. priority ASC (largest market cap / prominence rank first)
    // 3. name ASC (tie-breaker)
    const results = await prisma.$queryRaw<any[]>`
      SELECT symbol, name, currency, market, priority, "holderCount"
      FROM "StockMaster"
      WHERE symbol LIKE ${containsPattern} OR name LIKE ${containsPattern}
      ORDER BY 
        "holderCount" DESC,
        priority ASC,
        name ASC
      LIMIT 8
    `;

    return NextResponse.json(results);
  } catch (error) {
    console.error("❌ [Search API Error] Failed to search stock master:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
