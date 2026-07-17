"use client";

import { useState, useEffect, useRef } from "react";
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
  cashKRW?: number;
  cashUSD?: number;
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
  cashKRW = 0,
  cashUSD = 0,
}: AssetAllocationChartProps) {
  const [mounted, setMounted] = useState(false);
  
  // Independent hover states to prevent viewport flickering
  const [chartActiveIndex, setChartActiveIndex] = useState<number | null>(null);
  const [listActiveIndex, setListActiveIndex] = useState<number | null>(null);

  // Keep-alive bridge state for "기타 종목" detailed list
  const [isRightPanelHovered, setIsRightPanelHovered] = useState(false);
  
  const isRightPanelHoveredRef = useRef(false);
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep ref in sync with state for access inside timer closures
  useEffect(() => {
    isRightPanelHoveredRef.current = isRightPanelHovered;
  }, [isRightPanelHovered]);

  // Clean up any timers on unmount
  useEffect(() => {
    setMounted(true);
    return () => {
      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
      }
    };
  }, []);

  if (!mounted) {
    return (
      <div className="h-[380px] w-full flex flex-col items-center justify-center bg-white/20 border border-white/50 rounded-2xl p-6 text-center">
        <p className="text-xs font-bold text-slate-500">차트를 준비하는 중입니다...</p>
      </div>
    );
  }

  // Calculate total KRW valuation across all balances
  const totalStockValuation = balances.reduce((sum, item) => {
    const valuation = item.quantity * item.currentPrice * (item.currency === "USD" ? exchangeRate : 1);
    return sum + valuation;
  }, 0);

  // Calculate integrated cash KRW valuation (KRW Cash + USD Cash converted)
  const totalCashValue = cashKRW + (cashUSD * exchangeRate);

  // Total Portfolio Valuation (Stocks + Cash)
  const totalPortfolioValuation = totalStockValuation + totalCashValue;

  if (totalPortfolioValuation === 0) {
    return (
      <div className="h-[380px] w-full flex flex-col items-center justify-center bg-white/20 border border-white/50 rounded-2xl p-6 text-center">
        <p className="text-xs font-bold text-slate-500">
          차트를 구성할 자산(주식 및 현금)이 존재하지 않습니다.
        </p>
      </div>
    );
  }

  // Parse and calculate percentage for all items (fully unfolded list)
  const sortedItems = balances
    .map((item) => {
      const valuation = item.quantity * item.currentPrice * (item.currency === "USD" ? exchangeRate : 1);
      return {
        name: item.stockName,
        ticker: item.ticker,
        valuation,
        percentage: totalPortfolioValuation > 0 ? (valuation / totalPortfolioValuation) * 100 : 0,
      };
    });

  // Inject cash asset if greater than 0
  if (totalCashValue > 0) {
    sortedItems.push({
      name: "현금",
      ticker: "CASH",
      valuation: totalCashValue,
      percentage: totalPortfolioValuation > 0 ? (totalCashValue / totalPortfolioValuation) * 100 : 0,
    });
  }

  // Sort descending by valuation
  sortedItems.sort((a, b) => b.valuation - a.valuation);

  // Consolidate minor stock items (< 3.0%) into "기타 종목" for the LEFT Pie chart
  // Cash is a primary asset class and should never be consolidated
  const chartData: ChartDataItem[] = [];
  const thresholdPercent = 3.0; // 3% criterion

  const aboveThreshold = sortedItems.filter(
    (item) => item.percentage >= thresholdPercent || item.name === "현금"
  );
  const belowThreshold = sortedItems.filter(
    (item) => item.percentage < thresholdPercent && item.name !== "현금"
  );

  if (belowThreshold.length <= 1) {
    sortedItems.forEach((item) => {
      chartData.push({
        name: item.name,
        ticker: item.ticker,
        value: item.valuation,
        percentage: item.percentage,
      });
    });
  } else {
    aboveThreshold.forEach((item) => {
      chartData.push({
        name: item.name,
        ticker: item.ticker,
        value: item.valuation,
        percentage: item.percentage,
      });
    });

    const othersValuation = belowThreshold.reduce((sum, item) => sum + item.valuation, 0);
    chartData.push({
      name: "기타 종목",
      value: othersValuation,
      percentage: totalPortfolioValuation > 0 ? (othersValuation / totalPortfolioValuation) * 100 : 0,
      isOthers: true,
      details: belowThreshold,
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

  // Map the list row hover index to the corresponding chart slice index
  // Even if a minor stock is hovered in the unfolded list, it intelligently lights up the '기타 종목' slice on the left!
  let mappedListActiveIndex: number | null = null;
  if (listActiveIndex !== null && listActiveIndex < sortedItems.length) {
    const hoveredName = sortedItems[listActiveIndex].name;
    const chartIdx = chartData.findIndex(
      (entry) => entry.name === hoveredName || (entry.isOthers && entry.details?.some((sub) => sub.name === hoveredName))
    );
    if (chartIdx !== -1) {
      mappedListActiveIndex = chartIdx;
    }
  }

  // The active index passed to the Recharts Pie component for visual enlargement
  const displayActiveIndex = chartActiveIndex !== null ? chartActiveIndex : mappedListActiveIndex;

  // Debounced/delayed chart mouse leave to allow crossing the physical gap to the right details panel safely
  // ONLY applied when leaving '기타 종목' (Others) to ensure instant, snappy feedback on major assets!
  const handleChartMouseLeave = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
    }

    if (chartActiveIndex !== null && chartData[chartActiveIndex]?.isOthers) {
      // Set a tiny 250ms grace period ONLY for Others to move mouse to the right
      leaveTimerRef.current = setTimeout(() => {
        setChartActiveIndex((prev) => {
          // If the right panel is now hovered, protect the active index (keep-alive)
          if (prev !== null && chartData[prev]?.isOthers && isRightPanelHoveredRef.current) {
            return prev;
          }
          return null;
        });
      }, 250);
    } else {
      // For all other major assets/cash, instantly wipe the hover state for zero-lag responsiveness
      setChartActiveIndex(null);
    }
  };

  // Immediate chart mouse enter to clear any pending leave timer
  const handleChartMouseEnter = (index: number) => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
    }
    setChartActiveIndex(index);
  };

  // Active shape rendering function to expand sector on hover
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={0}
        outerRadius={outerRadius + 8} // Increased from +6 to +8 for a more pronounced float!
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        cornerRadius={4}
      />
    );
  };

  // Custom label renderer to draw bold white percentage text inside major pie slices (>= 3.0% weight)
  const renderCustomizedLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
    const percentageValue = percent * 100;
    
    // Only display label if there is sufficient visual space inside the slice (>= 3.0%)
    if (percentageValue < 3.0) return null;

    const RADIAN = Math.PI / 180;
    // Center the label perfectly inside the solid mass of each slice
    const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-[10px] font-black pointer-events-none"
      >
        {`${percentageValue.toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="w-full flex-1 glass-card p-5 rounded-2xl border border-white/60 bg-white/30 backdrop-blur-md shadow-sm relative flex flex-col justify-between min-h-[380px]">
      
      {/* 2-Column Responsive Layout directly from the top, removing full-width title block */}
      <div className="flex-1 flex flex-col md:flex-row items-center gap-6 w-full h-full">
        
        {/* Left Column: Title (localized!) + The Large filled Pie Chart */}
        <div className="w-full md:w-[50%] flex flex-col justify-start">
          {/* Title - localized to Left Column only, freeing the upper right viewport! */}
          <div className="mb-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-0.5">보유 자산 배분 비중</h3>
          </div>

          <div className="relative w-full h-[310px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart onMouseLeave={handleChartMouseLeave}>
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

                {/* Pie 1: Slices and Interactive Hover Expansion */}
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={115} // Majestic sizing
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  stroke="rgba(255, 255, 255, 0.4)"
                  strokeWidth={1}
                  activeIndex={displayActiveIndex !== null ? displayActiveIndex : undefined}
                  activeShape={renderActiveShape}
                  onMouseEnter={(_, idx) => handleChartMouseEnter(idx)}
                  onMouseLeave={handleChartMouseLeave}
                  style={{ outline: "none", cursor: "pointer" }}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`url(#${GRADIENT_IDS[index % GRADIENT_IDS.length]})`}
                      style={{
                        filter: displayActiveIndex === index 
                          ? "drop-shadow(0px 8px 16px rgba(99, 102, 221, 0.22))" 
                          : "drop-shadow(0px 4px 8px rgba(15, 23, 42, 0.08))",
                        transition: "all 0.2s ease-in-out",
                      }}
                    />
                  ))}
                </Pie>

                {/* Pie 2: 100% Transparent Label Overlay (Bypasses Recharts activeIndex label-suppression bug) */}
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={115}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  stroke="transparent"
                  fill="transparent"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  style={{ pointerEvents: "none" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Context-Sensitive Dynamic Viewport (starts at the absolute top level!) */}
        {/* Y-axis centered (justify-center) with adjusted vertical size to h-[320px] for lists to stretch h-[310px] */}
        <div className="w-full md:w-[50%] h-[320px] flex flex-col justify-center">
          {chartActiveIndex === null ? (
            /* DEFAULT STATE: Fully unfolded list of ALL individual assets (sortedItems) */
            <div className="w-full flex flex-col h-[310px] justify-start animate-in fade-in duration-200">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[9px] font-extrabold text-slate-400">
                  총 {sortedItems.length}개 종목
                </span>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain pr-1 space-y-1.5 scrollbar-thin">
                {sortedItems.map((entry, index) => {
                  const isRowHovered = listActiveIndex === index;
                  return (
                    <div
                      key={entry.name}
                      className={`flex items-center justify-between p-2.5 h-10 rounded-xl border transition-all duration-200 cursor-pointer ${
                        isRowHovered
                          ? "bg-white/80 border-indigo-100/50 shadow-sm translate-x-1"
                          : "hover:bg-white/40 border-transparent"
                      }`}
                      onMouseEnter={() => setListActiveIndex(index)}
                      onMouseLeave={() => setListActiveIndex(null)}
                    >
                      {/* Left: Category Name */}
                      <span className="font-extrabold text-slate-800 text-[13px] truncate tracking-tight leading-none pr-4">
                        {entry.name}
                      </span>

                      {/* Right: Category Percentage */}
                      <span className="text-[13px] font-black text-indigo-500 tracking-tight leading-none shrink-0">
                        {entry.percentage.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : chartData[chartActiveIndex].isOthers ? (
            /* GROUPED STATE: Hovering on '기타 종목' slice on the left lists all minor holdings descending */
            /* Enabled with "Keep-Alive Bridge" so moving mouse inside this panel keeps the details open! */
            <div 
              className="w-full flex flex-col h-[310px] justify-start animate-in fade-in duration-200"
              onMouseEnter={() => {
                setIsRightPanelHovered(true);
                if (leaveTimerRef.current) {
                  clearTimeout(leaveTimerRef.current);
                }
              }}
              onMouseLeave={() => {
                setIsRightPanelHovered(false);
                setChartActiveIndex(null); // Return to default list when leaving the panel
              }}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[9px] font-extrabold text-slate-400">
                  총 {chartData[chartActiveIndex].details?.length || 0}개 종목
                </span>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain pr-1 space-y-1.5 scrollbar-thin">
                {chartData[chartActiveIndex].details?.map((sub: any) => (
                  <div 
                    key={sub.name} 
                    className="flex items-center justify-between p-2.5 h-10 rounded-xl hover:bg-white/40 border border-transparent transition-all duration-200"
                  >
                    <span className="font-extrabold text-slate-800 text-[13px] truncate tracking-tight leading-none pr-4">
                      {sub.name}
                    </span>
                    <span className="text-[13px] font-black text-indigo-500 tracking-tight leading-none shrink-0">
                      {sub.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* FOCUSED STATE: Hovering on a single major asset slice shows just that asset's name and percentage */
            <div className="flex flex-col items-center justify-center w-full h-full space-y-3 relative -top-3.5 -left-6 animate-in fade-in zoom-in-95 duration-200">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight text-center max-w-[220px] truncate leading-none">
                {chartData[chartActiveIndex].name}
              </h2>
              <span className="text-4xl font-black text-indigo-500 tracking-tighter leading-none">
                {chartData[chartActiveIndex].percentage.toFixed(1)}%
              </span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
