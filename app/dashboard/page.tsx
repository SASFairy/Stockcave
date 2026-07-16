"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MemberTabs, { Member } from "@/components/MemberTabs";
import AccountCards, { AccountItem, StockBalanceItem } from "@/components/AccountCards";
import StockTable from "@/components/StockTable";

export default function DashboardPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [activeMemberId, setActiveMemberId] = useState<number | null>(null);

  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null);

  const [membersLoading, setMembersLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // REAL-TIME EXCHANGE RATE STATE
  const [exchangeRate, setExchangeRate] = useState<number>(1380.0);

  // EDIT MODE STATES
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Modals visibility
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);

  // Form states - Cash Management
  const [cashKRWInput, setCashKRWInput] = useState("");
  const [cashUSDInput, setCashUSDInput] = useState("");
  const [cashError, setCashError] = useState("");
  const [cashLoading, setCashLoading] = useState(false);

  // Form states - Add
  const [addTicker, setAddTicker] = useState("");
  const [addStockName, setAddStockName] = useState("");
  const [addQuantity, setAddQuantity] = useState("");
  const [addCurrency, setAddCurrency] = useState("KRW");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Smart Search Autocomplete States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any | null>(null);

  // Form states - Edit
  const [editingItem, setEditingItem] = useState<StockBalanceItem | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Form states - Delete
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Reset Add Stock Form
  const resetAddForm = () => {
    setAddTicker("");
    setAddStockName("");
    setAddQuantity("");
    setAddCurrency("KRW");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedStock(null);
    setIsManualMode(false);
    setAddError("");
  };

  // Debounced, abortable search effect for local stock cache
  useEffect(() => {
    if (isManualMode || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/holdings/search?q=${encodeURIComponent(searchQuery)}`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Failed to search stock master:", err);
        }
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce delay

    return () => {
      clearTimeout(delayDebounceFn);
      controller.abort();
    };
  }, [searchQuery, isManualMode]);

  // 1. Initial load: Fetch family members
  useEffect(() => {
    async function loadMembers() {
      try {
        const response = await fetch("/api/members");
        const data = await response.json();
        if (data.success && data.members.length > 0) {
          setMembers(data.members);
          setActiveMemberId(data.members[0].id); // Select first member
        }
      } catch (err) {
        console.error("Failed to load family members:", err);
      } finally {
        setMembersLoading(false);
      }
    }
    loadMembers();
  }, []);

  // 2. Load accounts and real-time balances when selected member changes
  useEffect(() => {
    if (activeMemberId === null) return;
    loadAccounts();
  }, [activeMemberId]);

  async function loadAccounts() {
    if (activeMemberId === null) return;
    setAccountsLoading(true);
    setSyncing(true);
    try {
      const response = await fetch(`/api/stock?memberId=${activeMemberId}`);
      const data = await response.json();
      if (data.success) {
        const formattedAccounts = data.accounts.map((acc: any) => ({
          accountId: acc.accountId,
          broker: acc.broker,
          accountName: acc.accountName,
          accountNo: acc.accountNo,
          synced: acc.synced,
          lastSyncedAt: acc.lastSyncedAt,
          balances: acc.balances,
          cashKRW: acc.cashKRW || 0,
          cashUSD: acc.cashUSD || 0,
        }));

        setAccounts(formattedAccounts);
        
        if (data.exchangeRate) {
          setExchangeRate(data.exchangeRate);
        }

        // Keep active account id if it still exists in the new list, else pick the first
        if (formattedAccounts.length > 0) {
          const stillExists = formattedAccounts.some((a: any) => a.accountId === activeAccountId);
          if (!stillExists) {
            setActiveAccountId(formattedAccounts[0].accountId);
          }
        } else {
          setActiveAccountId(null);
        }
      }
    } catch (err) {
      console.error("Failed to load account balances:", err);
    } finally {
      setAccountsLoading(false);
      setSyncing(false);
    }
  }

  const openCashModal = (accId?: number) => {
    const idToUse = accId || activeAccountId;
    const selectedAcc = accounts.find((a) => a.accountId === idToUse);
    if (!selectedAcc) return;
    if (accId) {
      setActiveAccountId(accId);
    }
    setCashKRWInput(selectedAcc.cashKRW?.toString() || "0");
    setCashUSDInput(selectedAcc.cashUSD?.toString() || "0");
    setCashError("");
    setIsCashModalOpen(true);
  };

  const handleCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) return;

    setCashLoading(true);
    setCashError("");

    try {
      const response = await fetch("/api/accounts/cash", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: activeAccountId,
          cashKRW: parseFloat(cashKRWInput) || 0,
          cashUSD: parseFloat(cashUSDInput) || 0,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setIsCashModalOpen(false);
        await loadAccounts();
      } else {
        setCashError(data.error || "예수금 업데이트에 실패했습니다.");
      }
    } catch (err) {
      console.error("Failed to update cash balances:", err);
      setCashError("서버 통신 중 오류가 발생했습니다.");
    } finally {
      setCashLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleRefresh = async () => {
    await loadAccounts();
  };

  // ADD STOCK SUBMIT
  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAccountId) return;
    setAddError("");

    // Block submission if in search mode but no ticker selected
    if (!isManualMode && !selectedStock) {
      setAddError("검색창에서 종목을 검색하여 선택해 주세요.");
      return;
    }

    setAddLoading(true);

    try {
      const response = await fetch("/api/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: activeAccountId,
          ticker: addTicker,
          stockName: addStockName,
          quantity: parseInt(addQuantity, 10),
          currency: addCurrency,
        }),
      });

      const data = await response.json();
      if (data.success) {
        resetAddForm();
        setIsAddModalOpen(false);
        // Refresh account balances
        await loadAccounts();
      } else {
        setAddError(data.error || "종목 추가 실패");
      }
    } catch (err) {
      setAddError("서버와의 통신 오류가 발생했습니다.");
    } finally {
      setAddLoading(false);
    }
  };

  // EDIT STOCK SUBMIT
  const handleEditStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setEditError("");
    setEditLoading(true);

    try {
      const response = await fetch("/api/holdings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingItem.id,
          quantity: parseInt(editQuantity, 10),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setIsEditModalOpen(false);
        setEditingItem(null);
        await loadAccounts();
      } else {
        setEditError(data.error || "수정 실패");
      }
    } catch (err) {
      setEditError("서버와의 통신 오류가 발생했습니다.");
    } finally {
      setEditLoading(false);
    }
  };

  // DELETE STOCK SUBMIT
  const handleDeleteStockSubmit = async () => {
    if (!deleteTargetId) return;
    setDeleteLoading(true);

    try {
      const response = await fetch(`/api/holdings?id=${deleteTargetId}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.success) {
        setIsDeleteModalOpen(false);
        setDeleteTargetId(null);
        await loadAccounts();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Trigger Edit Modal Open
  const triggerEditModal = (item: StockBalanceItem) => {
    setEditingItem(item);
    setEditQuantity(item.quantity.toString());
    setEditError("");
    setIsEditModalOpen(true);
  };

  // Trigger Delete Modal Open
  const triggerDeleteModal = (id: number) => {
    setDeleteTargetId(id);
    setIsDeleteModalOpen(true);
  };

  // Find active account details to display balances
  const activeAccount = accounts.find((acc) => acc.accountId === activeAccountId);
  const activeMemberName = members.find((m) => m.id === activeMemberId)?.name || "";

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-7xl mx-auto space-y-8 relative">
      {/* Pure CSS Slow-Floating Ambient Aurora Background Circles */}
      <div className="aurora-bg">
        <div className="aurora-circle aurora-circle-1" />
        <div className="aurora-circle aurora-circle-2" />
        <div className="aurora-circle aurora-circle-3" />
        <div className="aurora-circle aurora-circle-4" />
      </div>

      {/* Header Panel */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-5 h-5 animate-pulse"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-wide">
              Stockcave
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Edit Mode Toggle Switch */}
          <button
            type="button"
            onClick={() => setIsEditMode(!isEditMode)}
            title={isEditMode ? "관리 모드 종료" : "장부 관리 모드 시작"}
            className={`w-9 h-9 rounded-xl border transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
              isEditMode
                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10"
                : "bg-white/60 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-white"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className={`w-4 h-4 transition-transform duration-500 ${isEditMode ? "rotate-90 text-white" : ""}`}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.42 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </svg>
          </button>

          {/* Logout button */}
          <button
            type="button"
            onClick={handleLogout}
            className="h-9 px-4 text-xs font-bold rounded-xl bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 cursor-pointer active:scale-95 transition-all flex items-center justify-center"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* Main Dashboard section */}
      <section className="space-y-6 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">가족 구성원 선택</h2>
            <MemberTabs
              members={members}
              activeMemberId={activeMemberId}
              onChange={setActiveMemberId}
              isLoading={membersLoading}
            />
          </div>

          {activeAccount && (
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">실시간 시세 동기화</span>
              <span className="text-xs font-bold text-indigo-600">
                {new Date(activeAccount.lastSyncedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Account cards segment */}
        <div className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">증권 계좌 목록</h2>
          <AccountCards
            accounts={accounts}
            activeAccountId={activeAccountId}
            onChange={setActiveAccountId}
            isLoading={accountsLoading}
            exchangeRate={exchangeRate}
            isEditMode={isEditMode}
            onEditCash={openCashModal}
          />
        </div>

        {/* Stock Balances table segment */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">
              {activeMemberName && `${activeMemberName}의 `}보유 주식 실시간 잔고
            </h2>
          </div>
          <StockTable
            balances={activeAccount ? activeAccount.balances : []}
            isLoading={accountsLoading}
            isEditMode={isEditMode}
            onEdit={triggerEditModal}
            onDelete={triggerDeleteModal}
            onAdd={() => setIsAddModalOpen(true)}
          />
        </div>
      </section>

      {/* =========================================================================
          💎 GLASSMORPHIC MODAL - ADD STOCK (With Autocomplete & Manual Fallback)
          ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-md transition-opacity duration-300">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white/90 backdrop-blur-xl border border-white shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-slate-800 tracking-wide">새로운 주식 종목 추가</h3>
              {isManualMode ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsManualMode(false);
                    setSearchQuery("");
                    setSelectedStock(null);
                  }}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 underline cursor-pointer bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 transition-all"
                >
                  스마트 검색 전환
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsManualMode(true);
                    setSelectedStock(null);
                    setAddTicker("");
                    setAddStockName("");
                  }}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-700 underline cursor-pointer bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 transition-all"
                >
                  직접 수동 기입하기
                </button>
              )}
            </div>
            
            <form onSubmit={handleAddStockSubmit} className="space-y-4">
              {isManualMode ? (
                /* ================= MANUAL ENTRY FORM ================= */
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">통화 설정</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAddCurrency("KRW")}
                        className={`py-2.5 text-xs font-bold rounded-xl border transition-all ${
                          addCurrency === "KRW"
                            ? "bg-indigo-50 border-indigo-100 text-indigo-600"
                            : "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                        }`}
                      >
                        원화 (KRW)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddCurrency("USD")}
                        className={`py-2.5 text-xs font-bold rounded-xl border transition-all ${
                          addCurrency === "USD"
                            ? "bg-indigo-50 border-indigo-100 text-indigo-600"
                            : "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                        }`}
                      >
                        달러 (USD)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="addTicker" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      종목코드 (Ticker)
                    </label>
                    <input
                      type="text"
                      id="addTicker"
                      required
                      placeholder={addCurrency === "KRW" ? "예: 005930 (6자리 코드)" : "예: AAPL, TSLA"}
                      value={addTicker}
                      onChange={(e) => setAddTicker(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-300 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label htmlFor="addStockName" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                      종목명
                    </label>
                    <input
                      type="text"
                      id="addStockName"
                      required
                      placeholder="예: 삼성전자, 애플"
                      value={addStockName}
                      onChange={(e) => setAddStockName(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-300 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all font-semibold"
                    />
                  </div>
                </div>
              ) : (
                /* ================= SMART AUTOCOMPLETE SEARCH FORM ================= */
                <div className="space-y-4 animate-in fade-in duration-200">
                  {!selectedStock ? (
                    <div className="relative">
                      <label htmlFor="searchQuery" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        종목 검색 (명칭 또는 코드)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          id="searchQuery"
                          autoFocus
                          placeholder="검색어 입력 (예: 삼성전자, 테슬라, AAPL, 005930)..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-300 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all font-semibold"
                        />
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                          {isSearching ? (
                            <svg className="animate-spin h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Glassmorphic Auto-complete Floating Dropdown */}
                      {searchQuery.trim().length > 0 && (
                        <div className="absolute left-0 right-0 z-30 mt-1.5 max-h-60 overflow-y-auto rounded-2xl bg-white border border-slate-200/80 shadow-[0_15px_40px_rgba(0,0,0,0.08)] p-1.5 divide-y divide-slate-100">
                          {isSearching && searchResults.length === 0 && (
                            <p className="p-3 text-xs text-slate-500 text-center font-bold animate-pulse">종목 정보를 고속 검색 중...</p>
                          )}
                          {!isSearching && searchResults.length === 0 && (
                            <div className="p-3 text-center">
                              <p className="text-xs text-slate-500 font-bold mb-1">검색 결과가 없습니다.</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setAddStockName(searchQuery);
                                  setIsManualMode(true);
                                }}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 underline cursor-pointer"
                              >
                                💡 '{searchQuery}' 수동 기입으로 등록하기
                              </button>
                            </div>
                          )}
                          {searchResults.map((stock) => (
                            <button
                              key={stock.symbol}
                              type="button"
                              onClick={() => {
                                setSelectedStock(stock);
                                setAddTicker(stock.symbol);
                                setAddStockName(stock.koreanName || stock.name);
                                setAddCurrency(stock.currency);
                                setSearchResults([]);
                              }}
                              className="w-full text-left p-3 text-xs hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-between group cursor-pointer"
                            >
                              <div className="flex flex-col gap-0.5 max-w-[240px]">
                                <span className="font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                                  {stock.koreanName || stock.name}
                                </span>
                                {stock.koreanName && stock.koreanName !== stock.name && (
                                  <span className="text-[10px] text-slate-500 truncate font-bold">
                                    {stock.name}
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-500 font-extrabold uppercase">{stock.symbol} ({stock.market})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {stock.holderCount > 0 && (
                                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    보유 중 ({stock.holderCount}명)
                                  </span>
                                )}
                                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">
                                  {stock.currency}
                                </span>
                              </div>
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setIsManualMode(true);
                              setSelectedStock(null);
                            }}
                            className="w-full text-center py-2.5 text-[10px] font-extrabold text-slate-500 hover:text-slate-800 border-t border-slate-100 transition-colors cursor-pointer block mt-1"
                          >
                            💡 원하는 종목이 없으신가요? 직접 수동으로 입력하기
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Display premium Selected Stock badge if selected */
                    <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 relative overflow-hidden flex items-center justify-between animate-in zoom-in-95 duration-200">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">선택된 종목</span>
                        <span className="text-sm font-black text-slate-800">{addStockName}</span>
                        <span className="text-[10px] text-slate-500 font-extrabold uppercase">{addTicker} ({selectedStock.market})</span>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">
                          {addCurrency}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStock(null);
                            setAddTicker("");
                            setAddStockName("");
                          }}
                          className="text-[10px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer flex items-center gap-0.5 border border-rose-100 bg-rose-50 hover:bg-rose-100/50 px-2 py-0.5 rounded-md transition-all active:scale-95"
                        >
                          ❌ 다른 종목 검색
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quantity input - always shown if in manual mode or if a stock has been selected */}
              {(isManualMode || selectedStock) && (
                <div className="animate-in slide-in-from-bottom-2 duration-200">
                  <label htmlFor="addQuantity" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    보유 수량
                  </label>
                  <input
                    type="number"
                    id="addQuantity"
                    required
                    min="1"
                    placeholder="수량 입력"
                    value={addQuantity}
                    onChange={(e) => setAddQuantity(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-300 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all font-bold"
                  />
                </div>
              )}

              {addError && <p className="text-xs font-semibold text-rose-500 text-center">{addError}</p>}

              <div className="flex gap-3 mt-6">
                {/* 윈도우 컨벤션: 확인 왼쪽, 취소 오른쪽 */}
                <button
                  type="submit"
                  disabled={addLoading || (!isManualMode && !selectedStock)}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer active:scale-95 transition-all shadow-md shadow-indigo-600/10"
                >
                  {addLoading ? "추가 중..." : "종목 추가"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetAddForm();
                    setIsAddModalOpen(false);
                  }}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 cursor-pointer active:scale-95 transition-all"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          💎 GLASSMORPHIC MODAL - EDIT STOCK
          ========================================================================= */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-md transition-opacity duration-300">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white/90 backdrop-blur-xl border border-white shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800 tracking-wide mb-1">보유 주식 수량 변경</h3>
            <p className="text-xs text-indigo-600 font-extrabold mb-4">
              {editingItem.stockName} ({editingItem.ticker})
            </p>

            <form onSubmit={handleEditStockSubmit} className="space-y-4">
              <div>
                <label htmlFor="editQuantity" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  보유 수량
                </label>
                <input
                  type="number"
                  id="editQuantity"
                  required
                  min="1"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-white border border-slate-200 text-slate-800 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all font-bold"
                />
              </div>

              {editError && <p className="text-xs font-semibold text-rose-500 text-center">{editError}</p>}

              <div className="flex gap-3 mt-6">
                {/* 윈도우 컨벤션: 확인 왼쪽, 취소 오른쪽 */}
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer active:scale-95 transition-all shadow-md shadow-indigo-600/10"
                >
                  {editLoading ? "수정 중..." : "수정 완료"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingItem(null);
                  }}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 cursor-pointer active:scale-95 transition-all"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          💎 GLASSMORPHIC MODAL - DELETE CONFIRM
          ========================================================================= */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-md transition-opacity duration-300">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-white/90 backdrop-blur-xl border border-rose-100 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-rose-600 tracking-wide mb-2 flex items-center gap-2">
              종목 삭제 확인
            </h3>
            <p className="text-xs text-slate-500 font-bold mb-6">
              {activeAccount?.balances.find((b: any) => b.id === deleteTargetId)?.stockName || "선택한 종목"}을 장부에서 삭제하시겠습니까?
            </p>

            <div className="flex gap-3">
              {/* 윈도우 컨벤션: 확인 왼쪽, 취소 오른쪽 */}
              <button
                type="button"
                onClick={handleDeleteStockSubmit}
                disabled={deleteLoading}
                className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 cursor-pointer active:scale-95 transition-all shadow-md shadow-rose-600/10"
              >
                {deleteLoading ? "삭제 중..." : "장부에서 삭제"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteTargetId(null);
                }}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 cursor-pointer active:scale-95 transition-all"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          💎 GLASSMORPHIC MODAL - MANAGE CASH (KRW / USD)
          ========================================================================= */}
      {isCashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-md transition-opacity duration-300">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white/90 backdrop-blur-xl border border-white shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800 tracking-wide mb-6 flex items-center gap-2">
              계좌 예수금 관리
            </h3>

            <form onSubmit={handleCashSubmit} className="space-y-4">
              <div>
                <label htmlFor="cashKRW" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  원화 예수금 (KRW)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-sm font-bold text-slate-500">₩</span>
                  <input
                    type="number"
                    id="cashKRW"
                    required
                    min="0"
                    step="1"
                    value={cashKRWInput}
                    onChange={(e) => setCashKRWInput(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 text-sm rounded-xl bg-white border border-slate-200 text-slate-800 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all font-bold no-spinner"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="cashUSD" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex justify-between items-center">
                  <span>달러 예수금 (USD)</span>
                  <span className="text-[10px] text-indigo-600 font-bold italic">
                    실시간 환율: ₩{exchangeRate.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-2.5 text-sm font-bold text-slate-500">$</span>
                  <input
                    type="number"
                    id="cashUSD"
                    required
                    min="0"
                    step="0.01"
                    value={cashUSDInput}
                    onChange={(e) => setCashUSDInput(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 text-sm rounded-xl bg-white border border-slate-200 text-slate-800 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all font-bold no-spinner"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {cashError && <p className="text-xs font-semibold text-rose-500 text-center">{cashError}</p>}

              <div className="flex gap-3 mt-6">
                {/* 윈도우 컨벤션: 확인 왼쪽, 취소 오른쪽 */}
                <button
                  type="submit"
                  disabled={cashLoading}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer active:scale-95 transition-all shadow-md shadow-indigo-600/10"
                >
                  {cashLoading ? "저장 중..." : "예수금 저장"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCashModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 cursor-pointer active:scale-95 transition-all"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
