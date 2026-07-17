"use client";

import { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Sector,
} from "recharts";
import { StockBalanceItem } from "./AccountCards";

interface AssetAllocationChartProps {
  balances: StockBalanceItem[];
  exchangeRate: number;
}

interface ChartDataItem {
  name: string;
  ticker?: string;
  value: number;
  percentage: number;
  isOthers?: boolean;
  details?: any[];
}

export default function AssetAllocationChart({
  balances,
  exchangeRate,
}: AssetAllocationChartProps) {
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Prevent SSR hydration flicker by waiting until component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || balances.length === 0) {
    return (
      <div className="h-[280px] w-full flex flex-col items-center justify-center bg-white/20 border border-white/50 rounded-2xl p-6 text-center">
        <p className="text-xs font-bold text-slate-500">
          차트를 구성할 보유 주식 자산이 존재하지 않습니다.
        </p>
      </div>
    );
  }

  // Calculate total KRW valuation across all balances
  const totalStockValuation = balances.reduce((sum, item) => {
    const valuation = item.quantity * item.currentPrice * (item.currency === "USD" ? exchangeRate : 1);
    return sum + valuation;
  }, 0);

  // Parse and sort items descending
  const sortedItems = balances
    .map((item) => {
      const valuation = item.quantity * item.currentPrice * (item.currency === "USD" ? exchangeRate : 1);
      return {
        name: item.stockName,
        ticker: item.ticker,
        valuation,
        currency: item.currency,
        quantity: item.quantity,
      };
    })
    .sort((a, b) => b.valuation - a.valuation);

  // Consolidate into top 5 individually and group the rest into "Others"
  const chartData: ChartDataItem[] = [];

  if (sortedItems.length <= 6) {
    sortedItems.forEach((item) => {
      chartData.push({
        name: item.name,
        ticker: item.ticker,
        value: item.valuation,
        percentage: totalStockValuation > 0 ? (item.valuation / totalStockValuation) * 100 : 0,
      });
    });
  } else {
    const top5 = sortedItems.slice(0, 5);
    const others = sortedItems.slice(5);

    top5.forEach((item) => {
      chartData.push({
        name: item.name,
        ticker: item.ticker,
        value: item.valuation,
        percentage: totalStockValuation > 0 ? (item.valuation / totalStockValuation) * 100 : 0,
      });
    });

    const othersValuation = others.reduce((sum, item) => sum + item.valuation, 0);
    chartData.push({
      name: "기타 종목",
      value: othersValuation,
      percentage: totalStockValuation > 0 ? (othersValuation / totalStockValuation) * 100 : 0,
      isOthers: true,
      details: others,
    });
  }

  // Premium Linear Gradient Colors definition matching the glassmorphic dark-indigo vibe
  const GRADIENT_IDS = [
    "grad-indigo",
    "grad-violet",
    "grad-sky",
    "grad-emerald",
    "grad-rose",
    "grad-slate",
  ];

  // Active shape rendering function to expand sector on hover
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={0}
        outerRadius={outerRadius + 6} // Tactile floating expansion
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={4}
      />
    );
  };

  return (
    <div className="w-full flex-1 glass-card p-5 rounded-2xl border border-white/60 bg-white/30 backdrop-blur-md shadow-sm relative flex flex-col justify-between min-h-[340px]">
      {/* Title */}
      <div className="mb-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-0.5">보유 자산 배분 비중</h3>
      </div>

      {/* Main Row Layout - Left: Large Pie Chart / Right: Scrollable Stock List */}
      <div className="flex-1 flex flex-col md:flex-row items-center gap-6 w-full mt-2">
        
        {/* Left Half: The Large filled Pie Chart */}
        <div className="relative w-full md:w-[50%] h-[260px] flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                <linearGradient id="grad-indigo" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#e0e7ff" />
                  <stop offset="100%" stopColor="#a5b4fc" />
                </linearGradient>
                <linearGradient id="grad-violet" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f3e8ff" />
                  <stop offset="100%" stopColor="#d8b4fe" />
                </linearGradient>
                <linearGradient id="grad-sky" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#e0f2fe" />
                  <stop offset="100%" stopColor="#7dd3fc" />
                </linearGradient>
                <linearGradient id="grad-emerald" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#d1fae5" />
                  <stop offset="100%" stopColor="#6ee7b7" />
                </linearGradient>
                <linearGradient id="grad-rose" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#ffe4e6" />
                  <stop offset="100%" stopColor="#fda4af" />
                </linearGradient>
                <linearGradient id="grad-slate" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f1f5f9" />
                  <stop offset="100%" stopColor="#cbd5e1" />
                </linearGradient>
              </defs>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={0}
                outerRadius={105} // Majestic sizing
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                stroke="rgba(255, 255, 255, 0.4)"
                strokeWidth={1}
                activeIndex={activeIndex !== null ? activeIndex : undefined}
                activeShape={renderActiveShape}
                onMouseEnter={(_, idx) => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                style={{ outline: "none", cursor: "pointer" }}
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`url(#${GRADIENT_IDS[index % GRADIENT_IDS.length]})`}
                    style={{
                      filter: activeIndex === index 
                        ? "drop-shadow(0px 8px 16px rgba(99, 102, 241, 0.22))" 
                        : "drop-shadow(0px 4px 8px rgba(15, 23, 42, 0.08))",
                      transition: "all 0.2s ease-in-out",
                    }}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Right Half: Interactive Scrollable Asset Allocation List */}
        <div className="w-full md:w-[50%] h-[260px] flex flex-col justify-center">
          <div className="w-full h-[250px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
            {chartData.map((entry, index) => {
              const isSelected = activeIndex === index;
              return (
                <div
                  key={entry.name}
                  className={`flex items-center justify-between p-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "bg-white/80 border border-indigo-100/50 shadow-md translate-x-1"
                      : "hover:bg-white/40 border border-transparent"
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                >
                  {/* Left: Circular Gradient Indicator, Stock Name & Ticker */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full border border-white/50 shrink-0"
                      style={{
                        background: `url(#${GRADIENT_IDS[index % GRADIENT_IDS.length]})`,
                        boxShadow: isSelected ? "0 0 6px rgba(99, 102, 241, 0.4)" : "none",
                      }}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-extrabold text-slate-800 text-[11px] truncate tracking-tight">
                        {entry.name}
                      </span>
                      {entry.ticker ? (
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none mt-0.5">
                          {entry.ticker}
                        </span>
                      ) : (
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider leading-none mt-0.5">
                          INDEX
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Valuation and Asset Percentage Breakdown */}
                  <div className="text-right shrink-0 flex items-center gap-4">
                    <div className="flex flex-col text-right">
                      <p className="text-[11px] font-black text-slate-700 tracking-tight">
                        ₩{Math.round(entry.value).toLocaleString()}
                      </p>
                      {entry.isOthers && entry.details && (
                        <p className="text-[8px] font-bold text-slate-400 leading-none mt-0.5">
                          외 {entry.details.length}개 종목
                        </p>
                      )}
                    </div>
                    <div className="w-[42px] text-right">
                      <span className="text-[11px] font-black text-indigo-500 bg-indigo-50/50 border border-indigo-100/30 px-1.5 py-0.5 rounded-md">
                        {entry.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
