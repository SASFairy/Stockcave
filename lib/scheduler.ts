import cron from "node-cron";
import { prisma } from "./prisma";

/**
 * Initializes and starts the background Cron scheduler.
 * Runs entirely inside the Next.js Node.js server process (Docker-Native).
 */
export function startScheduler() {
  console.log("⏰ [Scheduler] Node-cron initialized and active.");

  // Schedule task: Run every day at 16:30 (4:30 PM) after Asian/Korean stock markets close and settle
  // Cron syntax: Minute(30) Hour(16) Day(any) Month(any) Day-of-week(any)
  cron.schedule("30 16 * * *", async () => {
    console.log("⏰ [Scheduler] Running daily asset valuation snapshot...");
    try {
      await recordDailySnapshot();
    } catch (error) {
      console.error("⏰ [Scheduler Error] Failed to record asset snapshot:", error);
    }
  });
}

/**
 * Iterates through all accounts, sums current balance values,
 * and records a daily snapshot in the SQLite database.
 */
async function recordDailySnapshot() {
  const today = new Date();
  // Format as "YYYY-MM-DD" in local timezone
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  // Fetch all accounts along with their current StockBalances
  const accounts = await prisma.account.findMany({
    include: {
      balances: true,
    },
  });

  console.log(`⏰ [Scheduler] Found ${accounts.length} accounts to evaluate for date: ${dateStr}`);

  for (const account of accounts) {
    // Calculate total assets valuation in KRW (USD stocks should ideally be multiplied by exchange rate,
    // let's assume a simplified constant of 1380 for USD or keep currency conversion modular)
    let totalEvaluation = 0;

    for (const balance of account.balances) {
      let itemValue = balance.quantity * balance.currentPrice;

      // Handle US dollar conversion simply if applicable
      if (balance.currency === "USD") {
        itemValue *= 1380; // Hardcoded fallback rate for simplicity in dev
      }

      totalEvaluation += itemValue;
    }

    // Insert or update daily snapshot in DB
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
