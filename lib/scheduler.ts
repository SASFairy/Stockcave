import cron from "node-cron";
import { prisma } from "./prisma";

/**
 * Initializes and starts the background Cron scheduler.
 * Runs entirely inside the Next.js Node.js server process (Docker-Native).
 */
export function startScheduler() {
  console.log("⏰ [Scheduler] Node-cron initialized and active.");

  // 1. Check if StockMaster is empty and trigger initial sync on startup asynchronously
  prisma.stockMaster.count()
    .then((count) => {
      if (count === 0) {
        console.log("⏰ [Scheduler] StockMaster cache is empty. Triggering initial synchronization in the background...");
        syncStockMaster();
      } else {
        console.log(`⏰ [Scheduler] StockMaster cache has ${count} records. Ready.`);
      }
    })
    .catch((err) => {
      console.error("⏰ [Scheduler Error] Failed to check StockMaster record count on startup:", err);
    });

  // 2. Schedule task: Run every day at 16:30 (4:30 PM) after Asian/Korean stock markets close and settle
  cron.schedule("30 16 * * *", async () => {
    console.log("⏰ [Scheduler] Running daily asset valuation snapshot...");
    try {
      await recordDailySnapshot();
    } catch (error) {
      console.error("⏰ [Scheduler Error] Failed to record asset snapshot:", error);
    }
  });

  // 3. Schedule task: Run every day at 02:00 AM for stock master cache sync (Daily Sync)
  cron.schedule("0 2 * * *", async () => {
    console.log("⏰ [Scheduler] Running daily stock master cache synchronization...");
    try {
      await syncStockMaster();
    } catch (error) {
      console.error("⏰ [Scheduler Error] Failed to sync stock master cache:", error);
    }
  });
}

/**
 * Iterates through all accounts, sums current balance values,
 * and records a daily snapshot in the SQLite database.
 */
async function recordDailySnapshot() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  const accounts = await prisma.account.findMany({
    include: {
      balances: true,
    },
  });

  console.log(`⏰ [Scheduler] Found ${accounts.length} accounts to evaluate for date: ${dateStr}`);

  for (const account of accounts) {
    let totalEvaluation = 0;

    for (const balance of account.balances) {
      let itemValue = balance.quantity * balance.currentPrice;

      if (balance.currency === "USD") {
        itemValue *= 1380; // Hardcoded fallback rate for simplicity in dev
      }

      totalEvaluation += itemValue;
    }

    await prisma.assetSnapshot.upsert({
      where: {
        accountId_date: {
          accountId: account.id,
          date: dateStr,
        },
      },
      update: {
        netWorth: totalEvaluation,
      },
      create: {
        accountId: account.id,
        date: dateStr,
        netWorth: totalEvaluation,
      },
    });

    console.log(
      `⏰ [Scheduler - Saved] Account: ${account.accountName} (#${account.id}) Total value: ${totalEvaluation.toLocaleString()} KRW`
    );
  }

  console.log("⏰ [Scheduler] Daily valuation snapshots completed successfully.");
}

/**
 * Synchronizes the local stock master cache from public endpoints (Naver sise and US listings).
 * Merges them, updates priorities, and calculates live family holder counts.
 */
export async function syncStockMaster() {
  console.log("🔄 [StockMaster Sync] Starting local stock cache synchronization...");
  try {
    const krStocks = await fetchKoreanStockMaster();
    const usStocks = await fetchUSStockMaster();
    const allStocks = [...krStocks, ...usStocks];

    console.log(`🔄 [StockMaster Sync] Parsed ${krStocks.length} KR stocks and ${usStocks.length} US stocks. Total: ${allStocks.length}`);

    // Upsert stocks in chunks of 100 to avoid SQLite limits or memory overhead
    const chunkSize = 100;
    for (let i = 0; i < allStocks.length; i += chunkSize) {
      const chunk = allStocks.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(stock =>
          prisma.stockMaster.upsert({
            where: { symbol: stock.symbol },
            update: {
              name: stock.name,
              currency: stock.currency,
              market: stock.market,
              priority: stock.priority,
            },
            create: {
              symbol: stock.symbol,
              name: stock.name,
              currency: stock.currency,
              market: stock.market,
              priority: stock.priority,
              holderCount: 0,
            },
          })
        )
      );
    }

    // Recalculate holderCounts based on current database StockBalances
    await updateAllHolderCounts();

    console.log("🔄 [StockMaster Sync] Local stock cache synchronized successfully!");
  } catch (error) {
    console.error("🔄 [StockMaster Sync Error] Failed to synchronize stock cache:", error);
  }
}

/**
 * Recalculates holderCount (number of unique family members holding each stock ticker)
 * across the entire system and caches it in StockMaster.
 */
export async function updateAllHolderCounts() {
  console.log("🔄 [StockMaster Sync] Updating holder counts for all active assets...");
  try {
    // Fetch all current holdings in the database
    const holdings = await prisma.stockBalance.findMany({
      select: {
        ticker: true,
        account: {
          select: {
            memberId: true,
          },
        },
      },
    });

    // Group holdings by ticker and collect unique memberId sets
    const tickerMemberMap: Record<string, Set<number>> = {};
    for (const h of holdings) {
      if (!tickerMemberMap[h.ticker]) {
        tickerMemberMap[h.ticker] = new Set<number>();
      }
      tickerMemberMap[h.ticker].add(h.account.memberId);
    }

    // Reset all holderCounts to 0
    await prisma.stockMaster.updateMany({
      data: { holderCount: 0 },
    });

    // Save recalculated holderCounts
    for (const [symbol, memberSet] of Object.entries(tickerMemberMap)) {
      await prisma.stockMaster.update({
        where: { symbol },
        data: { holderCount: memberSet.size },
      });
    }

    console.log("🔄 [StockMaster Sync] Recalculated holder counts successfully.");
  } catch (error) {
    console.error("🔄 [StockMaster Sync Error] Failed to update holder counts:", error);
  }
}

/**
 * Crawls Naver Finance market summary lists to scrape KOSPI & KOSDAQ stocks.
 * Crawls top 10 pages for each, covering the top 1000 largest market-cap stocks.
 * Decodes EUC-KR HTML page natively.
 */
async function fetchKoreanStockMaster() {
  const krStocks: { symbol: string; name: string; currency: string; market: string; priority: number }[] = [];
  const markets = [
    { sosok: 0, name: "KOSPI", maxPages: 45 },
    { sosok: 1, name: "KOSDAQ", maxPages: 40 },
  ];

  let overallRank = 1;

  for (const m of markets) {
    for (let page = 1; page <= m.maxPages; page++) {
      try {
        const url = `https://finance.naver.com/sise/sise_market_sum.naver?sosok=${m.sosok}&page=${page}`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        if (!res.ok) continue;

        const buffer = await res.arrayBuffer();
        const html = new TextDecoder("euc-kr").decode(buffer);

        // Regex: <a href="/item/main.naver?code=005930" class="tltle">삼성전자</a>
        const regex = /\/item\/main\.naver\?code=(\d{6})"\s+class="tltle">([^<]+)<\/a>/g;
        let match;
        let matchedCount = 0;
        while ((match = regex.exec(html)) !== null) {
          matchedCount++;
          const symbol = match[1];
          const name = match[2].trim();
          krStocks.push({
            symbol,
            name,
            currency: "KRW",
            market: m.name,
            priority: overallRank++,
          });
        }

        // If no items were parsed on this page, we have reached the end of the market directory
        if (matchedCount === 0) {
          console.log(`[StockMaster Sync] Reached the end of ${m.name} directory at page ${page}. Skipping subsequent pages.`);
          break;
        }
      } catch (err) {
        console.error(`[StockMaster Sync] Error crawling Naver sise sosok=${m.sosok} page=${page}:`, err);
      }
    }
  }

  // Crawl Korean ETFs from https://finance.naver.com/sise/etf.naver to cover popular family index investments
  try {
    const res = await fetch("https://finance.naver.com/sise/etf.naver", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const html = new TextDecoder("euc-kr").decode(buffer);
      // Naver ETF table has links matching /item/main.naver?code=069500
      const regex = /\/item\/main\.naver\?code=(\d{6})"[^>]*>([^<]+)<\/a>/g;
      let match;
      while ((match = regex.exec(html)) !== null) {
        const symbol = match[1];
        const name = match[2].trim();
        if (!krStocks.some(s => s.symbol === symbol)) {
          krStocks.push({
            symbol,
            name,
            currency: "KRW",
            market: "KOSPI ETF",
            priority: 4000 + overallRank++, // Lower priority baseline for ETFs
          });
        }
      }
    }
  } catch (err) {
    console.error("[StockMaster Sync] Failed to fetch Korean ETFs from Naver:", err);
  }

  return krStocks;
}

/**
 * Fetches general US stock ticker list from an active daily-updated stream,
 * overlays S&P 500 & top indices, and merges broader exchange directory listings (ETFs, SPACs).
 */
async function fetchUSStockMaster() {
  const usStocksMap: Record<string, { symbol: string; name: string; currency: string; market: string; priority: number }> = {};
  let usRank = 1;

  // 1. Fetch active, market-cap sorted US equities from Ate329's repository (top priority)
  try {
    const res = await fetch("https://raw.githubusercontent.com/Ate329/top-us-stock-tickers/main/tickers/all.csv");
    if (res.ok) {
      const csv = await res.text();
      const lines = csv.split("\n");
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(",");
        if (parts.length >= 2) {
          const symbol = parts[0].replace(/"/g, "").trim();
          const nameParts = parts.slice(1, parts.length - 4);
          const name = (nameParts.length > 0 ? nameParts.join(",") : parts[1]).replace(/"/g, "").trim();

          if (symbol && name) {
            usStocksMap[symbol] = {
              symbol,
              name,
              currency: "USD",
              market: "US Market",
              priority: 1000 + usRank++,
            };
          }
        }
      }
    }
  } catch (err) {
    console.error("[StockMaster Sync] Failed to fetch active US stock listings:", err);
  }

  // 2. Fetch the broader exchange directory (including NASDAQ/NYSE ETFs, minor tickers, and newer IPOs)
  try {
    const res = await fetch("https://raw.githubusercontent.com/datasets/nasdaq-listings/master/data/nasdaq-listed.csv");
    if (res.ok) {
      const csv = await res.text();
      const lines = csv.split("\n");
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(",");
        if (parts.length >= 2) {
          const symbol = parts[0].replace(/"/g, "").trim();
          const name = parts.slice(1).join(",").replace(/"/g, "").trim();

          if (symbol && name) {
            // Only add if not already present in the active stocks list (ensures market cap priority integrity)
            if (!usStocksMap[symbol]) {
              usStocksMap[symbol] = {
                symbol,
                name,
                currency: "USD",
                market: "US Ticker",
                priority: 10000 + usRank++, // Lower priority for miscellaneous listings
              };
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[StockMaster Sync] Failed to fetch broader US exchange directory listings:", err);
  }

  // 3. Inject highly traded, popular US ETFs specifically with elevated priority (sitting right under active stocks)
  const popularETFs = [
    { symbol: "SPY", name: "SPDR S&P 500 ETF Trust" },
    { symbol: "QQQ", name: "Invesco QQQ Trust Series 1" },
    { symbol: "VOO", name: "Vanguard S&P 500 ETF" },
    { symbol: "IVV", name: "iShares Core S&P 500 ETF" },
    { symbol: "IWM", name: "iShares Russell 2000 ETF" },
    { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF Trust" },
    { symbol: "SOXL", name: "Direxion Daily Semiconductor Bull 3X Shares" },
    { symbol: "SOXS", name: "Direxion Daily Semiconductor Bear 3X Shares" },
    { symbol: "TQQQ", name: "ProShares UltraPro QQQ 3X" },
    { symbol: "SQQQ", name: "ProShares UltraPro Short QQQ 3X" },
    { symbol: "JEPI", name: "JPMorgan Equity Premium Income ETF" },
    { symbol: "JEPQ", name: "JPMorgan Nasdaq Equity Premium Income ETF" },
    { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF" },
    { symbol: "GLD", name: "SPDR Gold Shares" },
    { symbol: "VTI", name: "Vanguard Total Stock Market ETF" },
    { symbol: "SCHD", name: "Schwab U.S. Dividend Equity ETF" },
    { symbol: "XLF", name: "Financial Select Sector SPDR Fund" },
    { symbol: "XLK", name: "Technology Select Sector SPDR Fund" },
    { symbol: "BIL", name: "SPDR Bloomberg 1-3 Month T-Bill ETF" },
    { symbol: "SHY", name: "iShares 1-3 Year Treasury Bond ETF" },
  ];

  let etfRank = 1;
  for (const etf of popularETFs) {
    if (usStocksMap[etf.symbol]) {
      usStocksMap[etf.symbol].priority = 5000 + etfRank++;
    } else {
      usStocksMap[etf.symbol] = {
        symbol: etf.symbol,
        name: etf.name,
        currency: "USD",
        market: "US ETF",
        priority: 5000 + etfRank++,
      };
    }
  }

  return Object.values(usStocksMap);
}
