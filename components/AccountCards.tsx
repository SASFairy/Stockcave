"use client";

import { useRef, useEffect } from "react";

export interface StockBalanceItem {
  id?: number;
  ticker: string;
  stockName: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  currency: string;
  previousClose?: number; // 📈 Live daily previous close value
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
  isAdminMode?: boolean; // 🔒 System settings security mode toggle
  onEditCash?: (accountId: number) => void; // 💰 Edit cash trigger function
  onDeleteAccount?: (accountId: number, name: string) => void; // 🗑️ Delete account callback
}

export default function AccountCards({
  accounts,
  activeAccountId,
  onChange,
  isLoading = false,
  exchangeRate = 1380.0, // fallback if not loaded yet
  isEditMode = false,
  isAdminMode = false,
  onEditCash,
  onDeleteAccount,
}: AccountCardsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDown = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isLoading, accounts.length]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    isDown.current = true;
    startX.current = e.pageX - el.offsetLeft;
    scrollLeft.current = el.scrollLeft;
  };

  const handleMouseLeave = () => {
    isDown.current = false;
  };

  const handleMouseUp = () => {
    isDown.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown.current) return;
    e.preventDefault();
    const el = scrollRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    el.scrollLeft = scrollLeft.current - walk;
  };

  if (isLoading) {
    return (
      <div className="flex flex-row gap-4 overflow-x-auto pb-4 w-full">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-44 w-[320px] shrink-0 bg-white/20 border border-white/40 rounded-2xl animate-pulse" />
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
    <div
      ref={scrollRef}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      className="flex flex-row gap-4 overflow-x-auto pb-4 w-full select-none"
    >
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
            className={`glass-card p-5 rounded-2xl cursor-pointer relative transition-all duration-300 flex flex-col justify-between w-[320px] shrink-0 ${
              isActive
                ? "border-indigo-500/50 bg-white/80 shadow-[0_16px_36px_rgba(99,102,241,0.12)] ring-1 ring-indigo-500/30 scale-[1.01]"
                : "border-white/60 bg-white/30 hover:bg-white/55 hover:border-indigo-500/10 shadow-[0_4px_20px_rgba(0,0,0,0.01)]"
            }`}
          >
            {/* Stripe/Vercel-style Top Gradient Bar for the Selected Card (Ultra-light bright pastel weights for premium minimalist look) */}
            {isActive && (
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-200 via-purple-200 to-sky-200 rounded-t-2xl" />
            )}

            <div>
              {/* Broker & Account Info */}
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-extrabold text-indigo-600 tracking-wider uppercase">
                      {account.broker}
                    </span>
                    <h3 className="text-sm font-bold text-slate-800 tracking-wide">
                      {account.accountName}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 font-bold">{account.accountNo}</p>
                </div>

                {/* Edit & Delete Controls */}
                {(isEditMode || isAdminMode) && (
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {/* Edit Cash Button - Group Settings edit mode */}
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={() => onEditCash?.(account.accountId)}
                        className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-600 transition-all cursor-pointer active:scale-90"
                        title="예수금 수정"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>
                    )}

                    {/* Delete Account Button - Admin Settings security mode */}
                    {isAdminMode && (
                      <button
                        type="button"
                        onClick={() => onDeleteAccount?.(account.accountId, account.accountName)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 transition-all cursor-pointer active:scale-90"
                        title="계좌 삭제"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>
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
