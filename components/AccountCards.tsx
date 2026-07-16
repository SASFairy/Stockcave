"use client";

export interface StockBalanceItem {
  id?: number;
  ticker: string;
  stockName: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  currency: string;
  fluctuationRate?: number; // 📈 Live daily price change percentage
}

export interface AccountItem {
  accountId: number;
  broker: string;
  accountName: string;
  accountNo: string;
  synced: boolean;
  lastSyncedAt: string | Date;
  balances: StockBalanceItem[];
  cashKRW?: number;
  cashUSD?: number;
}

interface AccountCardsProps {
  accounts: AccountItem[];
  activeAccountId: number | null;
  onChange: (id: number) => void;
  isLoading?: boolean;
  exchangeRate?: number; // 💰 Real-time exchange rate from server
  isEditMode?: boolean; // ⚙️ Book keeping edit mode toggle
  onEditCash?: (accountId: number) => void; // 💰 Edit cash trigger function
}

export default function AccountCards({
  accounts,
  activeAccountId,
  onChange,
  isLoading = false,
  exchangeRate = 1380.0, // fallback if not loaded yet
  isEditMode = false,
  onEditCash,
}: AccountCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-44 bg-white/5 border border-white/5 rounded-2xl animate-pulse" />
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

  // Calculate account stats using dual-currency rules
  const getAccountStats = (account: AccountItem, rateToUse: number) => {
    let totalKRWStocks = 0;
    let totalUSDStocks = 0;

    for (const item of account.balances) {
      if (item.currency === "USD") {
        totalUSDStocks += item.quantity * item.currentPrice;
      } else {
        totalKRWStocks += item.quantity * item.currentPrice;
      }
    }

    const cashKRW = account.cashKRW || 0;
    const cashUSD = account.cashUSD || 0;
    
    const totalUSD = totalUSDStocks + cashUSD;
    const totalCurrent = totalKRWStocks + cashKRW + totalUSD * rateToUse;

    return {
      totalKRWStocks,
      totalUSDStocks,
      cashKRW,
      cashUSD,
      totalUSD,
      totalCurrent,
    };
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {accounts.map((account) => {
        const isActive = account.accountId === activeAccountId;
        const {
          totalKRWStocks,
          totalUSDStocks,
          cashKRW,
          cashUSD,
          totalUSD,
          totalCurrent,
        } = getAccountStats(account, exchangeRate);

        const hasUSDAssets = totalUSD > 0;

        return (
          <div
            key={account.accountId}
            onClick={() => onChange(account.accountId)}
            className={`glass-card p-5 rounded-2xl cursor-pointer relative transition-all duration-300 flex flex-col justify-between ${
              isActive
                ? "border-indigo-500/40 bg-white/70 shadow-[0_12px_30px_rgba(99,102,241,0.06)] ring-1 ring-indigo-500/20"
                : "border-white/60 bg-white/30 hover:bg-white/55 hover:border-indigo-500/10 shadow-[0_4px_20px_rgba(0,0,0,0.01)]"
            }`}
          >
            <div>
              {/* Broker & Account Info */}
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 tracking-wider uppercase">
                      {account.broker}
                    </span>
                    <h3 className="text-sm font-bold text-slate-800 tracking-wide">
                      {account.accountName}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 font-bold">{account.accountNo}</p>
                </div>

                {/* Edit Cash Button - Same pencil icon as stock table */}
                {isEditMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // prevent card selection trigger
                      onEditCash?.(account.accountId);
                    }}
                    className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-600 transition-all cursor-pointer active:scale-90"
                    title="예수금 수정"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                    </svg>
                  </button>
                )}
              </div>

              {/* 전체 자산평가 (총 평가금액) */}
              <div className="mb-5">
                <p className="text-[11px] uppercase text-slate-500 tracking-widest font-black mb-1">총 평가 자산</p>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-black text-slate-800 tracking-tight">
                    ₩{Math.round(totalCurrent).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* ---------------------------------------------------------------------
                  국내 자산 요약
                  --------------------------------------------------------------------- */}
              <div className="space-y-2 py-3 border-t border-slate-100 text-sm font-semibold text-slate-700">
                <p className="text-[11px] uppercase text-slate-500 tracking-widest font-black mb-1.5">국내 자산</p>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">국내 주식 평가액</span>
                  <span className="text-slate-800 font-black text-sm">₩{Math.round(totalKRWStocks).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold">원화 예수금</span>
                  <span className="text-slate-800 font-black text-sm">₩{Math.round(cashKRW).toLocaleString()}</span>
                </div>
                {hasUSDAssets && (
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100/60 text-xs text-slate-500 font-bold">
                    <span>국내 자산 합계</span>
                    <span className="text-slate-800 font-black text-sm">₩{Math.round(totalKRWStocks + cashKRW).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* ---------------------------------------------------------------------
                  해외 자산 요약 (조건부 노출 & 완벽 레이아웃 일치)
                  --------------------------------------------------------------------- */}
              {hasUSDAssets && (
                <div className="space-y-2 py-3 border-t border-slate-100 text-sm font-semibold text-slate-700">
                  <p className="text-[11px] uppercase text-slate-500 tracking-widest font-black mb-1.5">해외 자산</p>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold">해외 주식 평가액</span>
                    <span className="text-slate-800 font-black text-sm">${totalUSDStocks.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold">달러 예수금</span>
                    <span className="text-slate-800 font-black text-sm">${cashUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100/60 text-xs text-slate-500 font-bold">
                    <span>해외 자산 합계</span>
                    <span className="text-slate-800 font-black text-sm">${totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100/60 text-sm text-slate-500 font-bold">
                    <span>원화 환산액</span>
                    <span className="text-slate-800 font-black text-sm">
                      ₩{Math.round(totalUSD * exchangeRate).toLocaleString()}
                      <span className="text-[10px] text-slate-500 font-extrabold ml-1.5">(환율 {exchangeRate.toLocaleString(undefined, { minimumFractionDigits: 0 })}원)</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
