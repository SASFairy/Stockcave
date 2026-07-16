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

    // High-performance SQLite 3-stage custom sorting search:
    // 1. Exact Match on symbol or name -> priority 1, others -> priority 2
    // 2. Sorted by holderCount DESC (most family members holding first)
    // 3. Sorted by priority ASC (largest market cap first)
    // 4. Sorted by name ASC as tie-breaker
    const results = await prisma.$queryRaw<any[]>`
      SELECT symbol, name, currency, market, priority, "holderCount"
      FROM "StockMaster"
      WHERE symbol LIKE ${containsPattern} OR name LIKE ${containsPattern}
      ORDER BY 
        CASE 
          WHEN LOWER(symbol) = LOWER(${query}) OR LOWER(name) = LOWER(${query}) THEN 1
          ELSE 2
        END ASC,
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
