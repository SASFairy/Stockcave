"use client";

export interface StockBalanceItem {
  id?: number;
  ticker: string;
  stockName: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  currency: string;
}

export interface AccountItem {
  accountId: number;
  broker: string;
  accountName: string;
  accountNo: string;
  synced: boolean;
  lastSyncedAt: string | Date;
  balances: StockBalanceItem[];
}

interface AccountCardsProps {
  accounts: AccountItem[];
  activeAccountId: number | null;
  onChange: (id: number) => void;
  isLoading?: boolean;
}

export default function AccountCards({ accounts, activeAccountId, onChange, isLoading = false }: AccountCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 bg-white/5 border border-white/5 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="p-8 text-center bg-white/5 border border-dashed border-border rounded-2xl text-muted text-sm">
        등록된 증권 계좌가 없습니다.
      </div>
    );
  }

  // Calculate account stats (total valuation only)
  const getAccountStats = (account: AccountItem) => {
    let totalCurrent = 0;

    for (const item of account.balances) {
      let exchangeRate = 1;
      if (item.currency === "USD") {
        exchangeRate = 1380; // Standard fallback exchange rate for USD
      }
      totalCurrent += item.quantity * item.currentPrice * exchangeRate;
    }

    return {
      totalCurrent,
    };
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {accounts.map((account) => {
        const isActive = account.accountId === activeAccountId;
        const { totalCurrent } = getAccountStats(account);

        return (
          <div
            key={account.accountId}
            onClick={() => onChange(account.accountId)}
            className={`glass-card p-5 rounded-2xl cursor-pointer relative ${
              isActive
                ? "border-primary/50 bg-indigo-500/5 shadow-[0_4px_20px_rgba(99,102,241,0.1)]"
                : "border-border"
            }`}
          >
            {/* Broker & Account Info */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-black px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 border border-white/5">
                  {account.broker}
                </span>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  {account.accountName}
                </h3>
              </div>
              <p className="text-xs text-muted font-mono">{account.accountNo}</p>
            </div>

            {/* Balances summary */}
            <div>
              <p className="text-[10px] uppercase text-muted tracking-wider font-semibold mb-0.5">평가 금액</p>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-extrabold text-white tracking-tight">
                  ₩{Math.round(totalCurrent).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
