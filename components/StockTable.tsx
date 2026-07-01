"use client";

import { StockBalanceItem } from "./AccountCards";

interface StockTableProps {
  balances: StockBalanceItem[];
  isLoading?: boolean;
}

export default function StockTable({ balances, isLoading = false }: StockTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-white/5 border border-white/5 rounded-xl animate-pulse" />
        <div className="h-24 bg-white/5 border border-white/5 rounded-xl animate-pulse" />
        <div className="h-24 bg-white/5 border border-white/5 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (balances.length === 0) {
    return (
      <div className="p-12 text-center bg-white/5 border border-dashed border-border rounded-2xl text-muted text-sm">
        보유 주식 잔고가 존재하지 않습니다.
      </div>
    );
  }

  const formatCurrency = (value: number, currency: string) => {
    if (currency === "USD") {
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `₩${Math.round(value).toLocaleString()}`;
  };

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-border bg-white/5 scrollbar-thin">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-border bg-black/25">
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted">종목</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted text-right">보유량</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted text-right">매입단가</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted text-right">현재가</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted text-right">평가금액</th>
            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-muted text-right">수익률 / 평가손익</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {balances.map((item) => {
            const valuation = item.quantity * item.currentPrice;
            const buyValue = item.quantity * item.avgBuyPrice;
            const pnl = valuation - buyValue;
            const returnRate = item.avgBuyPrice > 0 ? (pnl / buyValue) * 100 : 0;
            const isPositive = pnl >= 0;

            return (
              <tr
                key={item.ticker}
                className="hover:bg-white/5 transition-colors duration-200"
              >
                {/* Stock Name & Ticker */}
                <td className="px-6 py-4">
                  <div className="font-bold text-white tracking-wide">{item.stockName}</div>
                  <div className="text-xs font-mono font-bold text-muted flex items-center gap-1.5 mt-0.5">
                    {item.currency === "USD" && (
                      <span className="text-[9px] px-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-black uppercase">
                        US
                      </span>
                    )}
                    {item.ticker}
                  </div>
                </td>

                {/* Quantity */}
                <td className="px-6 py-4 text-right font-semibold font-mono text-white">
                  {item.quantity.toLocaleString()}
                </td>

                {/* Avg Buy Price */}
                <td className="px-6 py-4 text-right font-medium font-mono text-muted">
                  {formatCurrency(item.avgBuyPrice, item.currency)}
                </td>

                {/* Current Price */}
                <td className="px-6 py-4 text-right font-semibold font-mono text-white">
                  {formatCurrency(item.currentPrice, item.currency)}
                </td>

                {/* Total Valuation */}
                <td className="px-6 py-4 text-right font-extrabold font-mono text-white">
                  {formatCurrency(valuation, item.currency)}
                </td>

                {/* Return % and Profit & Loss */}
                <td className="px-6 py-4 text-right">
                  <div className={`text-sm font-extrabold font-mono ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                    {isPositive ? "+" : ""}
                    {returnRate.toFixed(2)}%
                  </div>
                  <div className={`text-xs font-mono font-medium mt-0.5 ${isPositive ? "text-emerald-400/75" : "text-red-400/75"}`}>
                    {isPositive ? "+" : ""}
                    {formatCurrency(pnl, item.currency)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
