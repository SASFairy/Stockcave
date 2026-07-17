"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MemberTabs, { Member } from "@/components/MemberTabs";
import AccountCards, { AccountItem, StockBalanceItem } from "@/components/AccountCards";
import StockTable from "@/components/StockTable";
import dynamic from "next/dynamic";

const AssetAllocationChart = dynamic(() => import("@/components/AssetAllocationChart"), {
  ssr: false,
  loading: () => (
    <div className="h-[260px] w-full flex-1 flex flex-col items-center justify-center bg-white/20 border border-white/50 rounded-2xl p-6 text-center animate-pulse">
      <span className="text-xs font-bold text-slate-500">차트를 그리는 중...</span>
    </div>
  ),
});

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
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);

  // System Settings Unlock states (isAdminUnlocked)
  const [isSettingsSecurityLockOpen, setIsSettingsSecurityLockOpen] = useState(false);
  const [settingsSecurityPinInput, setSettingsSecurityPinInput] = useState("");
  const [securityLockError, setSecurityLockError] = useState("");
  const [securityLockLoading, setSecurityLockLoading] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);

  // VIEW MODE STATE (Account vs Consolidated Portfolio)
  const [viewMode, setViewMode] = useState<"account" | "consolidated">("account");

  // Helper to aggregate stock balances across all accounts mathematically
  const getConsolidatedBalances = (accountsList: AccountItem[]): StockBalanceItem[] => {
    const map: { [ticker: string]: StockBalanceItem } = {};

    for (const account of accountsList) {
      for (const item of account.balances) {
        const existing = map[item.ticker];
        if (existing) {
          const totalQty = existing.quantity + item.quantity;
          const totalCost = (existing.quantity * existing.avgBuyPrice) + (item.quantity * item.avgBuyPrice);
          const weightedAvgBuyPrice = totalQty > 0 ? totalCost / totalQty : 0;

          existing.quantity = totalQty;
          existing.avgBuyPrice = weightedAvgBuyPrice;
          existing.currentPrice = item.currentPrice;
          existing.previousClose = item.previousClose;
        } else {
          map[item.ticker] = {
            ...item,
          };
        }
      }
    }

    return Object.values(map);
  };

  // Form states - Member addition
  const [newMemberName, setNewMemberName] = useState("");
  const [addMemberError, setAddMemberError] = useState("");
  const [addMemberLoading, setAddMemberLoading] = useState(false);

  // Form states - Account addition
  const [newAccountBroker, setNewAccountBroker] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountNo, setNewAccountNo] = useState("");
  const [newAccountAppKey, setNewAccountAppKey] = useState("");
  const [newAccountSecretKey, setNewAccountSecretKey] = useState("");
  const [newAccountCashKRW, setNewAccountCashKRW] = useState("");
  const [newAccountCashUSD, setNewAccountCashUSD] = useState("");
  const [addAccountError, setAddAccountError] = useState("");
  const [addAccountLoading, setAddAccountLoading] = useState(false);

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
  const [activeSearchIndex, setActiveSearchIndex] = useState<number>(-1);

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

  // Reset active search index on query or results changes
  useEffect(() => {
    setActiveSearchIndex(-1);
  }, [searchQuery, searchResults]);

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

  // 1. Initial load & refresh: Fetch family members
  const loadMembers = async (selectNewId?: number) => {
    try {
      const response = await fetch("/api/members");
      const data = await response.json();
      if (data.success) {
        setMembers(data.members);
        if (data.members.length > 0) {
          if (selectNewId) {
            setActiveMemberId(selectNewId);
          } else if (activeMemberId === null || !data.members.some((m: any) => m.id === activeMemberId)) {
            setActiveMemberId(data.members[0].id); // Select first member
          }
        } else {
          setActiveMemberId(null);
        }
      }
    } catch (err) {
      console.error("Failed to load family members:", err);
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  // Family Member addition handler
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      setAddMemberError("이름을 입력해주세요.");
      return;
    }
    setAddMemberLoading(true);
    setAddMemberError("");
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newMemberName }),
      });
      const data = await res.json();
      if (data.success) {
        setNewMemberName("");
        setIsAddMemberModalOpen(false);
        await loadMembers(data.member.id); // Refresh and select new member
      } else {
        setAddMemberError(data.error || "구성원 추가 중 오류가 발생했습니다.");
      }
    } catch (err) {
      console.error(err);
      setAddMemberError("서버 오류가 발생했습니다.");
    } finally {
      setAddMemberLoading(false);
    }
  };

  // Family Member deletion handler
  const handleDeleteMember = async (id: number, name: string) => {
    const confirmDelete = window.confirm(`"${name}" 구성원과 해당 구성원의 모든 계좌 및 보유 주식 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/members?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        if (activeMemberId === id) {
          setActiveMemberId(null);
        }
        await loadMembers();
      } else {
        alert(data.error || "구성원 삭제 중 오류가 발생했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("서버 오류가 발생했습니다.");
    }
  };

  // Broker Account addition handler
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMemberId) return;
    if (!newAccountBroker || !newAccountName.trim() || !newAccountNo.trim()) {
      setAddAccountError("모든 필수 입력 필드를 채워주세요.");
      return;
    }
    setAddAccountLoading(true);
    setAddAccountError("");
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: activeMemberId,
          broker: newAccountBroker,
          accountName: newAccountName,
          accountNo: newAccountNo,
          appKey: newAccountAppKey,
          secretKey: newAccountSecretKey,
          cashKRW: newAccountCashKRW ? parseFloat(newAccountCashKRW) : 0,
          cashUSD: newAccountCashUSD ? parseFloat(newAccountCashUSD) : 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewAccountBroker("");
        setNewAccountName("");
        setNewAccountNo("");
        setNewAccountAppKey("");
        setNewAccountSecretKey("");
        setNewAccountCashKRW("");
        setNewAccountCashUSD("");
        setIsAddAccountModalOpen(false);
        await loadAccounts(); // Reload accounts list
      } else {
        setAddAccountError(data.error || "계좌 추가 중 오류가 발생했습니다.");
      }
    } catch (err) {
      console.error(err);
      setAddAccountError("서버 오류가 발생했습니다.");
    } finally {
      setAddAccountLoading(false);
    }
  };

  // Broker Account deletion handler
  const handleDeleteAccount = async (accountId: number, name: string) => {
    const confirmDelete = window.confirm(`"${name}" 계좌와 해당 계좌의 모든 보유 주식 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/accounts?id=${accountId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        if (activeAccountId === accountId) {
          setActiveAccountId(null);
        }
        await loadAccounts(true);
      } else {
        alert(data.error || "계좌 삭제 중 오류가 발생했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("서버 오류가 발생했습니다.");
    }
  };

  // 2. Load accounts and real-time balances when selected member changes
  useEffect(() => {
    if (activeMemberId === null) return;
    loadAccounts();
  }, [activeMemberId]);

  async function loadAccounts(isSilent = false) {
    if (activeMemberId === null) return;
    if (!isSilent && accounts.length === 0) {
      setAccountsLoading(true);
    }
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
        await loadAccounts(true);
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

  const handleSecurityLockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityLockLoading(true);
    setSecurityLockError("");

    try {
      const response = await fetch("/api/auth/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: settingsSecurityPinInput }),
      });

      if (response.ok) {
        setIsSettingsSecurityLockOpen(false);
        setSettingsSecurityPinInput("");
        setIsAdminUnlocked(true);
      } else {
        const data = await response.json();
        setSecurityLockError(data.error || "비밀번호가 일치하지 않습니다.");
        setSettingsSecurityPinInput("");
      }
    } catch (err) {
      console.error("Settings PIN validation error:", err);
      setSecurityLockError("서버와 통신하는 중 오류가 발생했습니다.");
    } finally {
      setSecurityLockLoading(false);
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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSearchIndex((prev) => (prev + 1) % searchResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSearchIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const targetIndex = activeSearchIndex >= 0 ? activeSearchIndex : 0;
      const targetStock = searchResults[targetIndex];
      if (targetStock) {
        setSelectedStock(targetStock);
        setAddTicker(targetStock.symbol);
        setAddStockName(targetStock.koreanName || targetStock.name);
        setAddCurrency(targetStock.currency);
        setSearchResults([]);
      }
    }
  };

  const handleRefresh = async () => {
    await loadAccounts(true);
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
        // Refresh account balances silently
        await loadAccounts(true);
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
        await loadAccounts(true);
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
        await loadAccounts(true);
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

  // Consolidated Math Calculations across all brokerage accounts
  const totalCashKRW = accounts.reduce((sum, acc) => sum + (acc.cashKRW || 0), 0);
  const totalCashUSD = accounts.reduce((sum, acc) => sum + (acc.cashUSD || 0), 0);
  
  const totalKRWStocks = accounts.reduce((sum, acc) => {
    return sum + acc.balances.reduce((bSum, b) => b.currency === "KRW" ? bSum + (b.quantity * b.currentPrice) : bSum, 0);
  }, 0);
  
  const totalUSDStocks = accounts.reduce((sum, acc) => {
    return sum + acc.balances.reduce((bSum, b) => b.currency === "USD" ? bSum + (b.quantity * b.currentPrice) : bSum, 0);
  }, 0);

  const totalStockValuation = totalKRWStocks + (totalUSDStocks * exchangeRate);
  const totalNetWorth = totalStockValuation + totalCashKRW + (totalCashUSD * exchangeRate);

  // Synchronization Timing stable calculations
  const latestSyncTime = accounts.length > 0
    ? new Date(Math.max(...accounts.map((a) => new Date(a.lastSyncedAt || 0).getTime()))).toLocaleString()
    : "";
  const displaySyncTime = viewMode === "consolidated"
    ? latestSyncTime
    : (activeAccount ? new Date(activeAccount.lastSyncedAt).toLocaleString() : "");

  return (
    <div className="min-h-screen max-w-[1400px] mx-auto p-4 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8 relative">
      {/* Pure CSS Slow-Floating Ambient Aurora Background Circles */}
      <div className="aurora-bg">
        <div className="aurora-circle aurora-circle-1" />
        <div className="aurora-circle aurora-circle-2" />
        <div className="aurora-circle aurora-circle-3" />
        <div className="aurora-circle aurora-circle-4" />
      </div>

      {/* =========================================================================
          💎 LEFT SIDEBAR (LOGO, FAMILY GROUPS, CONTROLS)
          ========================================================================= */}
      <aside className="w-full md:w-64 shrink-0 flex flex-col gap-6 relative z-10">
        {/* Logo Box */}
        <div className="p-5 rounded-2xl glass-panel flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8.5 h-8.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-4 h-4 animate-pulse"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 18 9 11.25l4.306 4.307a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
                />
              </svg>
            </div>
            <h1 className="text-lg font-black text-slate-800 tracking-wide">
              Stockcave
            </h1>
          </div>
        </div>

        {/* Family Groups Sidebar Selector */}
        <div className="p-5 rounded-2xl glass-panel flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                GROUPS
              </h3>
            </div>
            {isAdminUnlocked && (
              <button
                type="button"
                onClick={() => setIsAddMemberModalOpen(true)}
                title="구성원 추가"
                className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 active:scale-90 transition-all flex items-center justify-center cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  className="w-3.5 h-3.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            )}
          </div>

          <nav className="flex flex-col gap-1.5">
            {membersLoading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-11 w-full bg-slate-100 rounded-xl" />
                ))}
              </div>
            ) : (
              members.map((member) => {
                const isActive = member.id === activeMemberId;
                return (
                  <div key={member.id} className="flex items-center gap-1.5 w-full">
                    <button
                      type="button"
                      onClick={() => setActiveMemberId(member.id)}
                      className={`flex items-center gap-3 flex-1 px-4 py-3 rounded-xl text-left text-xs font-black transition-all duration-300 cursor-pointer border ${
                        isActive
                          ? "bg-indigo-50 border-indigo-100 text-indigo-600 shadow-sm"
                          : "bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-white/40"
                      }`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={isActive ? 2.5 : 2}
                        stroke="currentColor"
                        className={`w-4 h-4 ${isActive ? "text-indigo-600" : "text-slate-500"}`}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                        />
                      </svg>
                      <span className="truncate">{member.name}</span>
                    </button>

                    {isAdminUnlocked && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMember(member.id, member.name)}
                        title={`${member.name} 삭제`}
                        className="w-9 h-9 shrink-0 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 hover:border-rose-200 active:scale-90 transition-all flex items-center justify-center cursor-pointer"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                          className="w-3.5 h-3.5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </nav>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-3 text-xs font-bold rounded-2xl bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-4 h-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"
            />
          </svg>
          로그아웃
        </button>

        {/* System Settings Button (Option 2) */}
        <button
          type="button"
          onClick={() => {
            if (isAdminUnlocked) {
              setIsAdminUnlocked(false);
            } else {
              setIsSettingsSecurityLockOpen(true);
            }
          }}
          className={`w-full py-3 text-xs font-bold rounded-2xl border cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 md:mt-auto ${
            isAdminUnlocked
              ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/10 hover:bg-indigo-500"
              : "bg-white/60 border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-white"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-4 h-4"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            />
          </svg>
          {isAdminUnlocked ? "설정 관리 잠금" : "시스템 설정"}
        </button>
      </aside>

      {/* =========================================================================
          💎 RIGHT MAIN CONTENT CANVAS
          ========================================================================= */}
      <main className="flex-1 space-y-6 relative z-10 min-w-0">
        {/* Sticky-like Info & Status Bar */}
        <header className="p-5 rounded-2xl glass-panel flex items-center justify-end gap-4">
          <div className="flex flex-wrap items-center gap-3.5">
            {/* Edit Mode Toggle Switch (Relocated to Right Main Header next to view toggle) */}
            <button
              type="button"
              onClick={() => setIsEditMode(!isEditMode)}
              title={isEditMode ? "장부 편집 모드 종료" : "장부 편집 모드 시작"}
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
                className={`w-5 h-5 transition-transform duration-500 ${isEditMode ? "rotate-90 text-white" : ""}`}
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

            {/* 3안 마이크로 세그먼트 토글 스위치 */}
            <div className="flex p-0.5 rounded-xl bg-slate-100/80 border border-slate-200/60 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode("account")}
                className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer select-none active:scale-95 ${
                  viewMode === "account"
                    ? "bg-white text-indigo-600 border border-slate-200/50 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                계좌별 자산
              </button>
              <button
                type="button"
                onClick={() => setViewMode("consolidated")}
                className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer select-none active:scale-95 ${
                  viewMode === "consolidated"
                    ? "bg-white text-indigo-600 border border-slate-200/50 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                종합 포트폴리오
              </button>
            </div>
            {displaySyncTime && (
              <div className="text-right min-w-[120px]">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">실시간 시세 동기화</span>
                <span className="text-xs font-bold text-indigo-600">
                  {displaySyncTime}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Account Cards / Consolidated Master Card */}
        {viewMode === "account" ? (
          <div className="space-y-4">
            {isAdminUnlocked && (
              <div className="flex items-center justify-end h-8">
                <button
                  type="button"
                  onClick={() => setIsAddAccountModalOpen(true)}
                  className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-100 transition-all cursor-pointer flex items-center gap-1 active:scale-95 animate-in fade-in slide-in-from-right-2 duration-200"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    className="w-3 h-3"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  계좌 추가
                </button>
              </div>
            )}
            <AccountCards
              accounts={accounts}
              activeAccountId={activeAccountId}
              onChange={setActiveAccountId}
              isLoading={accountsLoading}
              exchangeRate={exchangeRate}
              isEditMode={isEditMode}
              isAdminMode={isAdminUnlocked}
              onEditCash={openCashModal}
              onDeleteAccount={handleDeleteAccount}
            />
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex flex-col lg:flex-row gap-6 items-stretch w-full">
              {/* Consolidated Master Card - Identical Layout & Style to Brokerage Cards (Static, no click action) */}
              <div className="glass-card glass-card-static p-5 rounded-2xl relative transition-all duration-300 flex flex-col justify-between w-[320px] shrink-0 border-indigo-500/40 bg-white/70 shadow-[0_12px_30px_rgba(99,102,241,0.06)] ring-1 ring-indigo-500/20">
                <div>
                  {/* Header equivalent */}
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <div className="flex items-center mb-1">
                        <h3 className="text-sm font-bold text-slate-800 tracking-wide">
                          전체 포트폴리오
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* 총 자산평가 */}
                  <div className="mb-5">
                    <p className="text-[11px] uppercase text-slate-500 tracking-widest font-black mb-1">종합 순자산</p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-3xl font-black text-slate-800 tracking-tight">
                        ₩{Math.round(totalNetWorth).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* 국내 자산 요약 */}
                  <div className="space-y-2 py-3 border-t border-slate-100 text-sm font-semibold text-slate-700">
                    <p className="text-[11px] uppercase text-slate-500 tracking-widest font-black mb-1.5">국내 자산</p>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">주식 평가액</span>
                      <span className="text-slate-800 font-black text-sm">₩{Math.round(totalKRWStocks).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-bold">원화 예수금</span>
                      <span className="text-slate-800 font-black text-sm">₩{Math.round(totalCashKRW).toLocaleString()}</span>
                    </div>
                    {(totalUSDStocks > 0 || totalCashUSD > 0) && (
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100/60 text-xs text-slate-500 font-bold">
                        <span>국내 자산 합계</span>
                        <span className="text-slate-800 font-black text-sm">₩{Math.round(totalKRWStocks + totalCashKRW).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* 해외 자산 요약 */}
                  {(totalUSDStocks > 0 || totalCashUSD > 0) && (
                    <div className="space-y-2 py-3 border-t border-slate-100 text-sm font-semibold text-slate-700">
                      <p className="text-[11px] uppercase text-slate-500 tracking-widest font-black mb-1.5">해외 자산</p>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold">주식 평가액</span>
                        <span className="text-slate-800 font-black text-sm">${totalUSDStocks.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-bold">달러 예수금</span>
                        <span className="text-slate-800 font-black text-sm">${totalCashUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100/60 text-xs text-slate-500 font-bold">
                        <span>해외 자산 합계</span>
                        <span className="text-slate-800 font-black text-sm">${(totalUSDStocks + totalCashUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-slate-100/60 text-sm text-slate-500 font-bold">
                        <span>원화 환산액</span>
                        <span className="text-slate-800 font-black text-sm">
                          ₩{Math.round((totalUSDStocks + totalCashUSD) * exchangeRate).toLocaleString()}
                          <span className="text-[10px] text-slate-500 font-extrabold ml-1.5">(환율 {exchangeRate.toLocaleString(undefined, { minimumFractionDigits: 0 })}원)</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 📊 Asset Allocation Donut Chart Component */}
              <AssetAllocationChart
                balances={getConsolidatedBalances(accounts)}
                exchangeRate={exchangeRate}
                cashKRW={totalCashKRW}
                cashUSD={totalCashUSD}
              />
            </div>
          </div>
        )}

        {/* Stock Balances table segment */}
        <div className="space-y-4">
          <StockTable
            balances={viewMode === "consolidated" ? getConsolidatedBalances(accounts) : (activeAccount ? activeAccount.balances : [])}
            isLoading={accountsLoading}
            isEditMode={viewMode === "consolidated" ? false : isEditMode}
            onEdit={triggerEditModal}
            onDelete={triggerDeleteModal}
            onAdd={() => setIsAddModalOpen(true)}
            storageKey={viewMode === "consolidated" ? "consolidated" : (activeAccount ? `account_${activeAccount.accountId}` : undefined)}
          />
        </div>
      </main>

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
                          onKeyDown={handleSearchKeyDown}
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
                          {searchResults.map((stock, index) => (
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
                              className={`w-full text-left p-3 text-xs rounded-xl transition-all flex items-center justify-between group cursor-pointer ${
                                index === activeSearchIndex
                                  ? "bg-indigo-50/50 border border-indigo-100 text-indigo-600"
                                  : "hover:bg-slate-50 text-slate-700 border border-transparent"
                              }`}
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

      {/* =========================================================================
          💎 GLASSMORPHIC MODAL - ADD MEMBER
          ========================================================================= */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-md transition-opacity duration-300">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-white/90 backdrop-blur-xl border border-white shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800 tracking-wide mb-6">
              구성원 추가
            </h3>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label htmlFor="newMemberName" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  구성원 이름
                </label>
                <input
                  type="text"
                  id="newMemberName"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-white border border-slate-200 text-slate-800 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all font-bold"
                  maxLength={10}
                />
              </div>

              {addMemberError && <p className="text-xs font-semibold text-rose-500 text-center">{addMemberError}</p>}

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={addMemberLoading}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer active:scale-95 transition-all shadow-md shadow-indigo-600/10"
                >
                  {addMemberLoading ? "추가 중..." : "구성원 추가"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddMemberModalOpen(false);
                    setNewMemberName("");
                    setAddMemberError("");
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
          💎 GLASSMORPHIC MODAL - ADD BROKER ACCOUNT
          ========================================================================= */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-md transition-opacity duration-300">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white/90 backdrop-blur-xl border border-white shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-black text-slate-800 tracking-wide mb-6">
              증권 계좌 추가
            </h3>

            <form onSubmit={handleAddAccount} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="newAccountBroker" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    증권사
                  </label>
                  <input
                    type="text"
                    id="newAccountBroker"
                    required
                    value={newAccountBroker}
                    onChange={(e) => setNewAccountBroker(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm rounded-xl bg-white border border-slate-200 text-slate-800 placeholder-slate-300 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all font-bold"
                    placeholder="예: KB증권, 토스증권 등"
                    maxLength={30}
                  />
                </div>

                <div>
                  <label htmlFor="newAccountName" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    계좌 별칭
                  </label>
                  <input
                    type="text"
                    id="newAccountName"
                    required
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm rounded-xl bg-white border border-slate-200 text-slate-800 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all font-bold"
                    placeholder="예: 통합계좌, ISA, 미국주식용"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="newAccountNo" className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  계좌번호
                </label>
                <input
                  type="text"
                  id="newAccountNo"
                  required
                  value={newAccountNo}
                  onChange={(e) => setNewAccountNo(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-white border border-slate-200 text-slate-800 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all font-bold"
                  placeholder="예: 301-2245-8122-01"
                />
              </div>

              {addAccountError && <p className="text-xs font-semibold text-rose-500 text-center">{addAccountError}</p>}

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={addAccountLoading}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer active:scale-95 transition-all shadow-md shadow-indigo-600/10"
                >
                  {addAccountLoading ? "추가 중..." : "계좌 추가"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddAccountModalOpen(false);
                    setNewAccountBroker("");
                    setNewAccountName("");
                    setNewAccountNo("");
                    setNewAccountAppKey("");
                    setNewAccountSecretKey("");
                    setNewAccountCashKRW("");
                    setNewAccountCashUSD("");
                    setAddAccountError("");
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
          💎 GLASSMORPHIC MODAL - SYSTEM SETTINGS SECURITY LOCK
          ========================================================================= */}
      {isSettingsSecurityLockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-md transition-opacity duration-300">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-white/90 backdrop-blur-xl border border-white shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center mb-6">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3 shadow-sm">
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
                    d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">설정 잠금 해제</h3>
              <p className="text-[11px] text-slate-500 font-bold mt-1 text-center">구조 설정을 변경하려면 관리자 비밀번호를 입력해 주세요.</p>
            </div>

            <form onSubmit={handleSecurityLockSubmit} className="space-y-4">
              <div>
                <input
                  type="password"
                  required
                  value={settingsSecurityPinInput}
                  onChange={(e) => setSettingsSecurityPinInput(e.target.value)}
                  maxLength={100}
                  className="w-full px-4 py-2.5 text-center text-sm rounded-xl bg-white border border-slate-200 text-slate-800 focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all font-bold"
                  placeholder="비밀번호를 입력하세요"
                  autoFocus
                />
              </div>

              {securityLockError && <p className="text-xs font-semibold text-rose-500 text-center">{securityLockError}</p>}

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={securityLockLoading}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer active:scale-95 transition-all shadow-md shadow-indigo-600/10"
                >
                  {securityLockLoading ? "인증 중..." : "확인"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsSecurityLockOpen(false);
                    setSettingsSecurityPinInput("");
                    setSecurityLockError("");
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


    </div>
  );
}
