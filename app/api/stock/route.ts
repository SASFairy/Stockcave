import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

/**
 * Core engine API: /api/stock
 * Query parameters: ?memberId=<number>
 * 
 * Flow:
 * 1. Fetches Member's Accounts and their previously stored StockBalances.
 * 2. Attempts to sync real-time stock balances from the Broker APIs.
 * 3. Incorporates AES decryption, Token caching (BrokerToken), and API Throttling.
 * 4. GRACEFUL FALLBACK: If Broker API fails (maintenance, network error, invalid key),
 *    returns cached DB data with [synced: false] to prevent crashing.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberIdStr = searchParams.get("memberId");

    if (!memberIdStr) {
      return NextResponse.json({ success: false, error: "memberId 파라미터가 필요합니다." }, { status: 400 });
    }

    const memberId = parseInt(memberIdStr, 10);
    if (isNaN(memberId)) {
      return NextResponse.json({ success: false, error: "유효하지 않은 memberId입니다." }, { status: 400 });
    }

    // 1. Fetch Member, Accounts, StockBalances and cached Tokens
    const accounts = await prisma.account.findMany({
      where: { memberId },
      include: {
        balances: true,
        token: true,
      },
    });

    const results = [];

    // 2. Iterate accounts and attempt real-time sync with Throttling
    for (const account of accounts) {
      let isSynced = false;
      let freshBalances = [];

      try {
        // A. Throttling: Delay 200ms between each account to prevent API Rate Limits
        await new Promise((resolve) => setTimeout(resolve, 200));

        // B. Decrypt broker credentials safely
        const decryptedAppKey = decrypt(account.appKey);
        const decryptedSecretKey = decrypt(account.secretKey);

        // C. Fetch or reuse token cache
        let accessToken = "";
        const now = new Date();

        if (account.token && account.token.expiredAt > now) {
          accessToken = account.token.accessToken;
          console.log(`[Token Cache] Reusing cached token for Account: ${account.accountName}`);
        } else {
          console.log(`[Token Cache] Token expired or missing. Requesting new token for: ${account.accountName}`);
          
          // Call Broker Auth/Token endpoint
          accessToken = await fetchBrokerToken(account.broker, decryptedAppKey, decryptedSecretKey);

          // Save/Update token cache in DB
          await prisma.brokerToken.upsert({
            where: { accountId: account.id },
            update: {
              accessToken,
              expiredAt: new Date(Date.now() + 1000 * 60 * 60 * 23), // Expire in 23 hours (broker tokens are typically 24h)
            },
            create: {
              accountId: account.id,
              accessToken,
              expiredAt: new Date(Date.now() + 1000 * 60 * 60 * 23),
            },
          });
        }

        // D. Fetch real-time balances from the Broker API using the valid token
        freshBalances = await fetchRealtimeBalances(account.broker, account.accountNo, accessToken);
        isSynced = true;

        // E. Sync successful! Update DB StockBalance cache and lastSyncedAt
        await prisma.$transaction(async (tx) => {
          // Delete old balances for this account
          await tx.stockBalance.deleteMany({ where: { accountId: account.id } });

          // Write new balances
          for (const item of freshBalances) {
            await tx.stockBalance.create({
              data: {
                accountId: account.id,
                ticker: item.ticker,
                stockName: item.stockName,
                quantity: item.quantity,
                avgBuyPrice: item.avgBuyPrice,
                currentPrice: item.currentPrice,
                currency: item.currency || "KRW",
              },
            });
          }
        });

        console.log(`[Sync Success] Successfully synchronized Account: ${account.accountName}`);
      } catch (syncError) {
        // G. GRACEFUL FALLBACK: Logging connection/maintenance errors and reusing SQLite DB cache
        console.warn(
          `[Sync Failed - Falling back to cache] Account ${account.accountName} sync failed. Reason:`,
          syncError instanceof Error ? syncError.message : syncError
        );
        isSynced = false;
        // Use previously stored DB balances
        freshBalances = account.balances.map((b) => ({
          ticker: b.ticker,
          stockName: b.stockName,
          quantity: b.quantity,
          avgBuyPrice: b.avgBuyPrice,
          currentPrice: b.currentPrice,
          currency: b.currency,
        }));
      }

      results.push({
        accountId: account.id,
        broker: account.broker,
        accountName: account.accountName,
        accountNo: account.accountNo,
        synced: isSynced,
        lastSyncedAt: isSynced ? new Date() : account.updatedAt,
        balances: freshBalances,
      });
    }

    return NextResponse.json({ success: true, accounts: results });
  } catch (error) {
    console.error("GET Stock API Error:", error);
    return NextResponse.json({ success: false, error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// ==========================================
// 🔌 BROKER API INTEGRATION UTILS (CUSTOMIZABLE)
// ==========================================

/**
 * Fetches access token from the respective broker API.
 * Currently simulates mock token issuance, easily swap with real fetch calls.
 */
async function fetchBrokerToken(broker: string, appKey: string, secretKey: string): Promise<string> {
  // If credentials are "mock", return a dummy token immediately
  if (appKey === "mock" || secretKey === "mock") {
    return "MOCK_TOKEN_SUCCESS_" + Math.random().toString(36).substring(7);
  }

  // ----------------------------------------------------
  // [TEMPLATE: 한국투자증권 (Korea Investment & Securities) Real Token API]
  // ----------------------------------------------------
  // const response = await fetch("https://openapi.koreainvestment.com:29443/oauth2/tokenP", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({
  //     grant_type: "client_credentials",
  //     appkey: appKey,
  //     appsecret: secretKey
  //   })
  // });
  // if (!response.ok) throw new Error("Broker auth server rejected credentials");
  // const data = await response.json();
  // return data.access_token;
  // ----------------------------------------------------

  // For initial dev, use simulated mock data if real endpoints are not configured
  return "DEV_TOKEN_" + Math.random().toString(36).substring(7);
}

/**
 * Fetches stock balances from the respective broker API.
 * Simulates random current prices for development, easily swap with real REST endpoints.
 */
async function fetchRealtimeBalances(broker: string, accountNo: string, accessToken: string) {
  // If using simulation, return high-quality mock portfolios
  if (accessToken.startsWith("MOCK") || accessToken.startsWith("DEV")) {
    return getMockPortfolio(accountNo);
  }

  // ----------------------------------------------------
  // [TEMPLATE: 한국투자증권 Real Balance Inquiry API (u9600000 / 주식잔고조회)]
  // ----------------------------------------------------
  // const response = await fetch("https://openapi.koreainvestment.com:29443/u9600000", {
  //   method: "GET",
  //   headers: {
  //     "Content-Type": "application/json",
  //     "Authorization": `Bearer ${accessToken}`,
  //     "appkey": "...",
  //     "appsecret": "...",
  //     "tr_id": "TTTC8434R" // 국내주식 잔고조회 실전 tr_id
  //   }
  // });
  // if (!response.ok) throw new Error("Broker balance API returned error status");
  // const data = await response.json();
  // return data.output1.map(item => ({
  //   ticker: item.pdno, // 종목코드
  //   stockName: item.prdt_name, // 종목명
  //   quantity: parseInt(item.hldg_qty, 10), // 보유수량
  //   avgBuyPrice: parseFloat(item.pchs_avg_pric), // 매입단가
  //   currentPrice: parseFloat(item.prpr) // 현재가
  // }));
  // ----------------------------------------------------

  return getMockPortfolio(accountNo);
}

// High-fidelity portfolio generation helper for immediate out-of-the-box UI interaction
function getMockPortfolio(accountNo: string) {
  const seed = parseInt(accountNo.replace(/-/g, ""), 10) || 12345;
  
  const pool = [
    { ticker: "005930", stockName: "삼성전자", avgBuyPrice: 72000, volatility: 0.05 },
    { ticker: "035420", stockName: "NAVER", avgBuyPrice: 195000, volatility: 0.08 },
    { ticker: "000660", stockName: "SK하이닉스", avgBuyPrice: 165000, volatility: 0.12 },
    { ticker: "035720", stockName: "카카오", avgBuyPrice: 48000, volatility: 0.07 },
    { ticker: "373220", stockName: "LG에너지솔루션", avgBuyPrice: 380000, volatility: 0.15 },
    { ticker: "005380", stockName: "현대차", avgBuyPrice: 240000, volatility: 0.06 },
    { ticker: "AAPL", stockName: "Apple Inc.", avgBuyPrice: 180, volatility: 0.04, currency: "USD" },
    { ticker: "TSLA", stockName: "Tesla Inc.", avgBuyPrice: 175, volatility: 0.25, currency: "USD" },
  ];

  // Pick 3 to 5 stocks based on account seed
  const size = 3 + (seed % 3);
  const portfolio = [];

  for (let i = 0; i < size; i++) {
    const stockIndex = (seed + i * 3) % pool.length;
    const stock = pool[stockIndex];

    // Simulate mild price movement around the buy price for highly realistic returns
    const rand = Math.sin(seed + i) * stock.volatility;
    const currentPrice = parseFloat((stock.avgBuyPrice * (1 + rand)).toFixed(stock.currency === "USD" ? 2 : 0));
    const quantity = 5 + ((seed * (i + 1)) % 100);

    portfolio.push({
      ticker: stock.ticker,
      stockName: stock.stockName,
      quantity,
      avgBuyPrice: stock.avgBuyPrice,
      currentPrice,
      currency: stock.currency || "KRW",
    });
  }

  return portfolio;
}
