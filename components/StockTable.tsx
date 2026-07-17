"use client";

import { useState, useEffect } from "react";
import { StockBalanceItem } from "./AccountCards";

interface StockTableProps {
  balances: StockBalanceItem[];
  isLoading?: boolean;
  isEditMode?: boolean;
  onEdit?: (item: StockBalanceItem) => void;
  onDelete?: (id: number) => void;
  onAdd?: () => void;
  storageKey?: string; // 💾 Key to isolate drag-and-drop order in localStorage
}

export default function StockTable({
  balances,
  isLoading = false,
  isEditMode = false,
  onEdit,
  onDelete,
  onAdd,
  storageKey,
}: StockTableProps) {
  // Column Sorting States
  const [sortConfig, setSortConfig] = useState<{
    key: "quantity" | "currentPrice" | "valuation" | null;
    direction: "asc" | "desc" | null;
  }>({ key: null, direction: null });

  // Custom Drag-and-drop Order States
  const [tickerOrder, setTickerOrder] = useState<string[]>([]);
  const [draggedTicker, setDraggedTicker] = useState<string | null>(null);
  const [dragOverTicker, setDragOverTicker] = useState<string | null>(null);

  // Sync custom ticker order with localStorage whenever storageKey shifts
  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`stock_order_${storageKey}`);
      if (saved) {
        try {
          setTickerOrder(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse stock custom order:", e);
        }
      } else {
        setTickerOrder([]);
      }
    } else {
      setTickerOrder([]);
    }
  }, [storageKey]);

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

  // 3-way toggle sort function: DESC -> ASC -> RESET (custom/drag order)
  const handleSort = (key: "quantity" | "currentPrice" | "valuation") => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === "desc") {
          return { key, direction: "asc" };
        } else if (prev.direction === "asc") {
          return { key: null, direction: null };
        }
      }
      return { key, direction: "desc" };
    });
  };

  // Retrieve sorted balances considering both active sortConfig and custom tickerOrder
  const getSortedBalances = () => {
    const items = [...balances];

    // 1. Prioritize column headers sorting if active
    if (sortConfig.key) {
      items.sort((a, b) => {
        let valA = 0;
        let valB = 0;

        if (sortConfig.key === "quantity") {
          valA = a.quantity;
          valB = b.quantity;
        } else if (sortConfig.key === "currentPrice") {
          valA = a.currentPrice;
          valB = b.currentPrice;
        } else if (sortConfig.key === "valuation") {
          valA = a.quantity * a.currentPrice;
          valB = b.quantity * b.currentPrice;
        }

        if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
      return items;
    }

    // 2. Otherwise fallback to custom drag order
    if (tickerOrder.length > 0) {
      items.sort((a, b) => {
        const indexA = tickerOrder.indexOf(a.ticker);
        const indexB = tickerOrder.indexOf(b.ticker);

        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return 0;
      });
    }

    return items;
  };

  // Drag and drop event handlers
  const handleDragStart = (e: React.DragEvent, ticker: string) => {
    setDraggedTicker(ticker);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, ticker: string) => {
    e.preventDefault();
    if (ticker !== dragOverTicker) {
      setDragOverTicker(ticker);
    }
  };

  const handleDragEnd = () => {
    setDraggedTicker(null);
    setDragOverTicker(null);
  };

  const handleDrop = (e: React.DragEvent, targetTicker: string) => {
    e.preventDefault();
    const currentDragged = draggedTicker;
    handleDragEnd();

    if (!currentDragged || currentDragged === targetTicker) return;

    const sortedBalances = getSortedBalances();
    const currentTickers = sortedBalances.map((b) => b.ticker);

    const fromIndex = currentTickers.indexOf(currentDragged);
    const toIndex = currentTickers.indexOf(targetTicker);

    if (fromIndex === -1 || toIndex === -1) return;

    const newTickers = [...currentTickers];
    newTickers.splice(fromIndex, 1);
    newTickers.splice(toIndex, 0, currentDragged);

    setTickerOrder(newTickers);
    if (storageKey) {
      localStorage.setItem(`stock_order_${storageKey}`, JSON.stringify(newTickers));
    }

    // Switch sort status back to custom/drag-and-drop order immediately!
    setSortConfig({ key: null, direction: null });
  };

  const sortedBalancesList = getSortedBalances();

  return (
    <div className="space-y-4">
      <div className="w-full overflow-x-auto rounded-2xl border border-white/60 bg-white/30 backdrop-blur-md scrollbar-thin shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500">종목</th>
              {/* Interactive headers */}
              <th
                onClick={() => handleSort("quantity")}
                className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500 text-right cursor-pointer hover:text-slate-800 transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  보유량
                  <span className="text-[10px] text-indigo-500 font-extrabold w-3 inline-block transition-transform duration-200">
                    {sortConfig.key === "quantity" ? (sortConfig.direction === "asc" ? "▲" : "▼") : " "}
                  </span>
                </div>
              </th>
              <th
                onClick={() => handleSort("currentPrice")}
                className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500 text-right cursor-pointer hover:text-slate-800 transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  실시간 현재가
                  <span className="text-[10px] text-indigo-500 font-extrabold w-3 inline-block transition-transform duration-200">
                    {sortConfig.key === "currentPrice" ? (sortConfig.direction === "asc" ? "▲" : "▼") : " "}
                  </span>
                </div>
              </th>
              <th
                onClick={() => handleSort("valuation")}
                className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500 text-right cursor-pointer hover:text-slate-800 transition-colors select-none"
              >
                <div className="flex items-center justify-end gap-1">
                  총 평가금액
                  <span className="text-[10px] text-indigo-500 font-extrabold w-3 inline-block transition-transform duration-200">
                    {sortConfig.key === "valuation" ? (sortConfig.direction === "asc" ? "▲" : "▼") : " "}
                  </span>
                </div>
              </th>
              {isEditMode && (
                <th className="px-6 py-4 text-xs font-black uppercase tracking-wider text-slate-500 text-center">관리</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedBalancesList.length === 0 ? (
              <tr>
                <td
                  colSpan={isEditMode ? 5 : 4}
                  className="p-12 text-center text-slate-500 text-sm font-bold"
                >
                  보유 주식 잔고가 존재하지 않습니다. {isEditMode && "새로운 종목을 추가해 보세요!"}
                </td>
              </tr>
            ) : (
              sortedBalancesList.map((item) => {
                const valuation = item.quantity * item.currentPrice;

                // Calculate real-time absolute change and fluctuation rate from previousClose
                const previousClose = item.previousClose || item.currentPrice;
                const absoluteChange = item.currentPrice - previousClose;
                const fluctuationRate = previousClose !== 0 ? (absoluteChange / previousClose) * 100 : 0;

                const formatAbsoluteChange = (change: number, currency: string) => {
                  const absChange = Math.abs(change);
                  if (currency === "USD") {
                    return absChange.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                  }
                  return Math.round(absChange).toLocaleString();
                };

                const isDragged = item.ticker === draggedTicker;
                const isDragOver = item.ticker === dragOverTicker && !isDragged;

                return (
                  <tr
                    key={item.ticker}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, item.ticker)}
                    onDragOver={(e) => handleDragOver(e, item.ticker)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, item.ticker)}
                    className={`transition-all duration-200 cursor-grab active:cursor-grabbing select-none ${
                      isDragged
                        ? "opacity-40 bg-indigo-50/30 scale-[0.98] ring-1 ring-indigo-100"
                        : isDragOver
                          ? "bg-indigo-50/20 border-y border-indigo-100/50"
                          : "hover:bg-white/40"
                    }`}
                  >
                    {/* Stock Name & Ticker */}
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-bold text-slate-800 tracking-wide">{item.stockName}</div>
                        <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5 mt-1">
                          {item.currency === "USD" && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100 font-black uppercase">
                              US
                            </span>
                          )}
                          {item.ticker}
                        </div>
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
                      {fluctuationRate !== 0 && (
                        <div className={`text-[10px] font-bold mt-0.5 flex items-center justify-end gap-1 ${
                          fluctuationRate > 0
                            ? "text-rose-500"
                            : fluctuationRate < 0
                              ? "text-blue-500"
                              : "text-slate-500"
                        }`}>
                          <span>
                            {fluctuationRate > 0 ? "▲" : fluctuationRate < 0 ? "▼" : ""}
                          </span>
                          <span>
                            {formatAbsoluteChange(absoluteChange, item.currency)}
                          </span>
                          <span className="ml-0.5 opacity-90">
                            ({fluctuationRate > 0 ? "+" : ""}{fluctuationRate.toFixed(2)}%)
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
                        <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
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
