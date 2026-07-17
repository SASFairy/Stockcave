import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateAllHolderCounts } from "@/lib/scheduler";

export const dynamic = "force-dynamic";


/**
 * Helper to fetch public stock prices (Naver for Korean 6-digit codes, Yahoo for others)
 */
async function fetchPublicPrice(ticker: string, currency: string): Promise<number | null> {
  try {
    const cleanTicker = ticker.trim();
    const isKoreanTicker = /^\d{6}$/.test(cleanTicker);

    if (isKoreanTicker) {
      // Korean stock - Naver Finance Polling API
      const url = `https://polling.finance.naver.com/api/realtime?query=SERVICE_ITEM:${cleanTicker}`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) {
        const data = await res.json();
        const datas = data?.result?.areas?.[0]?.datas || data?.datas;
        const rawPrice = datas?.[0]?.nv;
        if (rawPrice !== undefined && rawPrice !== null) {
          return typeof rawPrice === "number" ? rawPrice : parseFloat(rawPrice.toString().replace(/,/g, ""));
        }
      }
      // Fallback: Yahoo Finance with .KS or .KQ
      let yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanTicker}.KS`;
      let yahooRes = await fetch(yahooUrl);
      let yData = yahooRes.ok ? await yahooRes.json() : null;
      let price = yData?.chart?.result?.[0]?.meta?.regularMarketPrice;

      if (!price) {
        yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanTicker}.KQ`;
        yahooRes = await fetch(yahooUrl);
        if (yahooRes.ok) {
          yData = await yahooRes.json();
          price = yData?.chart?.result?.[0]?.meta?.regularMarketPrice;
        }
      }

      if (price) return price;
    } else {
      // US stock - Yahoo Finance Chart API
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${cleanTicker}`;
      const yahooRes = await fetch(yahooUrl);
      if (yahooRes.ok) {
        const yData = await yahooRes.json();
        const price = yData?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (price) return price;
      }
    }
  } catch (err) {
    console.error(`[Public Price Fetch Error] Failed for ticker ${ticker}:`, err);
  }
  return null;
}

/**
 * POST: Add a new holding to an account
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { accountId, ticker, stockName, quantity, currency = "KRW" } = body;

    if (!accountId || !ticker || !stockName || quantity === undefined) {
      return NextResponse.json({ success: false, error: "필수 정보가 누락되었습니다." }, { status: 400 });
    }

    const cleanTicker = ticker.trim().toUpperCase();

    // Check if duplicate ticker already exists in this account
    const existing = await prisma.stockBalance.findFirst({
      where: { accountId: parseInt(accountId, 10), ticker: cleanTicker }
    });

    if (existing) {
      return NextResponse.json({ success: false, error: "이미 계좌 내에 동일한 종목이 등록되어 있습니다." }, { status: 400 });
    }

    // Attempt to fetch live current price
    const currentPrice = await fetchPublicPrice(cleanTicker, currency);

    const balance = await prisma.stockBalance.create({
      data: {
        accountId: parseInt(accountId, 10),
        ticker: cleanTicker,
        stockName: stockName.trim(),
        quantity: parseInt(quantity, 10),
        avgBuyPrice: 0.0, // average buy price is defaulted to 0 since we removed it
        currentPrice: currentPrice || 0.0,
        currency,
      }
    });

    // Recalculate holder count of modified stock asynchronously in the background
    updateAllHolderCounts().catch((err) =>
      console.error("🔄 [Background StockMaster Sync Error] Failed to update holder counts:", err)
    );

    return NextResponse.json({ success: true, balance });
  } catch (error) {
    console.error("POST Holdings API Error:", error);
    return NextResponse.json({ success: false, error: "종목 등록 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}

/**
 * PUT: Edit an existing holding (quantity only)
 */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, quantity } = body;

    if (!id || quantity === undefined) {
      return NextResponse.json({ success: false, error: "필수 수정 정보가 누락되었습니다." }, { status: 400 });
    }

    await prisma.stockBalance.update({
      where: { id: parseInt(id, 10) },
      data: {
        quantity: parseInt(quantity, 10),
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT Holdings API Error:", error);
    return NextResponse.json({ success: false, error: "종목 수정 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}

/**
 * DELETE: Delete a holding by id
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idStr = searchParams.get("id");

    if (!idStr) {
      return NextResponse.json({ success: false, error: "id 파라미터가 필요합니다." }, { status: 400 });
    }

    await prisma.stockBalance.delete({
      where: { id: parseInt(idStr, 10) }
    });

    // Recalculate holder count of modified stock asynchronously in the background
    updateAllHolderCounts().catch((err) =>
      console.error("🔄 [Background StockMaster Sync Error] Failed to update holder counts:", err)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Holdings API Error:", error);
    return NextResponse.json({ success: false, error: "종목 삭제 중 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
