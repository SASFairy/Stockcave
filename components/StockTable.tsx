"use client";

import { StockBalanceItem } from "./AccountCards";

interface StockTableProps {
  balances: StockBalanceItem[];
  isLoading?: boolean;
  isEditMode?: boolean;
  onEdit?: (item: StockBalanceItem) => void;
  onDelete?: (id: number) => void;
  onAdd?: () => void;
}

export default function StockTable({
  balances,
  isLoading = false,
  isEditMode = false,
  onEdit,
  onDelete,
  onAdd,
}: StockTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-white/30 border border-white/60 rounded-xl animate-pulse" />
        <div className="h-24 bg-white/20 border border-white/50 rounded-xl animate-pulse" />
        <div className="h-24 bg-white/20 border border-white/50 rounded-xl animate-pulse" />
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
    <div className="space-y-4">
      <div className="w-full overflow-x-auto rounded-2xl border border-white/60 bg-white/30 backdrop-blur-md scrollbar-thin shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500">종목</th>
              <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500 text-right">보유량</th>
              <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500 text-right">실시간 현재가</th>
              <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500 text-right">총 평가금액</th>
              {isEditMode && (
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500 text-center">관리</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {balances.length === 0 ? (
              <tr>
                <td
                  colSpan={isEditMode ? 5 : 4}
                  className="p-12 text-center text-slate-500 text-sm font-bold"
                >
                  보유 주식 잔고가 존재하지 않습니다. {isEditMode && "새로운 종목을 추가해 보세요!"}
                </td>
              </tr>
            ) : (
              balances.map((item) => {
                const valuation = item.quantity * item.currentPrice;

                return (
                  <tr
                    key={item.ticker}
                    className="hover:bg-white/40 transition-colors duration-200"
                  >
                    {/* Stock Name & Ticker */}
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800 tracking-wide">{item.stockName}</div>
                      <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mt-1">
                        {item.currency === "USD" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100 font-black uppercase">
                            US
                          </span>
                        )}
                        {item.ticker}
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="px-6 py-4 text-right font-extrabold text-slate-700">
                      {item.quantity.toLocaleString()}
                    </td>

                    {/* Current Price & Daily Change Rate */}
                    <td className="px-6 py-4 text-right">
                      <div className="font-extrabold text-slate-800">
                        {formatCurrency(item.currentPrice, item.currency)}
                      </div>
                      {item.fluctuationRate !== undefined && item.fluctuationRate !== null && item.fluctuationRate !== 0 && (
                        <div className={`text-[10px] font-bold mt-0.5 flex items-center justify-end gap-0.5 ${
                          item.fluctuationRate > 0
                            ? "text-rose-500"
                            : item.fluctuationRate < 0
                              ? "text-blue-500"
                              : "text-slate-500"
                        }`}>
                          <span>
                            {item.fluctuationRate > 0 ? "▲" : item.fluctuationRate < 0 ? "▼" : ""}
                          </span>
                          <span>
                            {Math.abs(item.fluctuationRate).toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Total Valuation */}
                    <td className="px-6 py-4 text-right font-black text-slate-800">
                      {formatCurrency(valuation, item.currency)}
                    </td>

                    {/* Manage Buttons (Pencil and Trash) */}
                    {isEditMode && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Edit button */}
                          <button
                            type="button"
                            onClick={() => onEdit?.(item)}
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-600 transition-all cursor-pointer active:scale-90"
                            title="수량 수정"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                            </svg>
                          </button>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => item.id && onDelete?.(item.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 transition-all cursor-pointer active:scale-90"
                            title="삭제"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.108 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.108 0 0 0-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isEditMode && onAdd && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-95 text-xs"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            새로운 종목 추가
          </button>
        </div>
      )}
    </div>
  );
}
