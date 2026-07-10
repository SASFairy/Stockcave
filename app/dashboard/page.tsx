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

  // EDIT MODE STATES
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Modals visibility
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form states - Add
  const [addTicker, setAddTicker] = useState("");
  const [addStockName, setAddStockName] = useState("");
  const [addQuantity, setAddQuantity] = useState("");
  const [addCurrency, setAddCurrency] = useState("KRW");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // Form states - Edit
  const [editingItem, setEditingItem] = useState<StockBalanceItem | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Form states - Delete
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
        }));

        setAccounts(formattedAccounts);

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
        // Reset form and close
        setAddTicker("");
        setAddStockName("");
        setAddQuantity("");
        setAddCurrency("KRW");
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
      {/* Background glow meshes */}
      <div className="absolute top-10 right-10 w-[300px] h-[300px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[300px] h-[300px] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />

      {/* Header Panel */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl glass-panel relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
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
            <h1 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
              Stockcave <span className="text-[10px] bg-indigo-500/10 text-indigo-300 font-bold px-1.5 py-0.5 rounded border border-indigo-500/20 uppercase tracking-widest">v2.0</span>
            </h1>
            <p className="text-[11px] text-muted font-medium mt-0.5">가족 멀티 계좌 관리 및 실시간 주식 포트폴리오 장부</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Edit Mode Toggle Switch */}
          <button
            type="button"
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
              isEditMode
                ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                : "bg-white/5 border-white/5 text-muted hover:text-white"
            }`}
          >
            ⚙️ 장부 관리 모드 {isEditMode ? "ON" : "OFF"}
          </button>

          {/* Logout button */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-red-500/10 border border-red-500/15 hover:bg-red-500/20 text-red-400 cursor-pointer active:scale-95 transition-all"
          >
            로그아웃
          </button>
        </div>
      </header>

      {/* Main Dashboard section */}
      <section className="space-y-6 relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-muted mb-2">가족 구성원 선택</h2>
            <MemberTabs
              members={members}
              activeMemberId={activeMemberId}
              onChange={setActiveMemberId}
              isLoading={membersLoading}
            />
          </div>

          {activeAccount && (
            <div className="text-right">
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">실시간 시세 동기화</span>
              <span className="text-xs font-mono font-bold text-indigo-300">
                {new Date(activeAccount.lastSyncedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Account cards segment */}
        <div className="space-y-4">
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-muted">증권 계좌 목록</h2>
          <AccountCards
            accounts={accounts}
            activeAccountId={activeAccountId}
            onChange={setActiveAccountId}
            isLoading={accountsLoading}
          />
        </div>

        {/* Stock Balances table segment */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-muted">
              {activeMemberName && `${activeMemberName}의 `}보유 주식 실시간 잔고
            </h2>
            {isEditMode && (
              <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                관리 모드 가동 중: 종목을 추가하거나 보유 수량을 편리하게 조절해 보세요!
              </span>
            )}
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
          💎 GLASSMORPHIC MODAL - ADD STOCK
          ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-300">
          <div className="w-full max-w-md p-6 rounded-2xl glass-panel border border-white/10 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-white tracking-wide mb-4">🆕 새로운 주식 종목 추가</h3>
            
            <form onSubmit={handleAddStockSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">통화 설정</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAddCurrency("KRW")}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      addCurrency === "KRW"
                        ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-300"
                        : "bg-white/5 border-white/5 text-muted hover:text-white"
                    }`}
                  >
                    원화 (KRW)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddCurrency("USD")}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      addCurrency === "USD"
                        ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-300"
                        : "bg-white/5 border-white/5 text-muted hover:text-white"
                    }`}
                  >
                    달러 (USD)
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="addTicker" className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  종목코드 (Ticker)
                </label>
                <input
                  type="text"
                  id="addTicker"
                  required
                  placeholder={addCurrency === "KRW" ? "예: 005930 (6자리 코드)" : "예: AAPL, TSLA"}
                  value={addTicker}
                  onChange={(e) => setAddTicker(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50 transition-colors font-mono font-bold"
                />
              </div>

              <div>
                <label htmlFor="addStockName" className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  종목명
                </label>
                <input
                  type="text"
                  id="addStockName"
                  required
                  placeholder="예: 삼성전자, 애플"
                  value={addStockName}
                  onChange={(e) => setAddStockName(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50 transition-colors font-semibold"
                />
              </div>

              <div>
                <label htmlFor="addQuantity" className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
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
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50 transition-colors font-mono font-bold"
                />
              </div>

              {addError && <p className="text-xs font-semibold text-red-400 text-center">{addError}</p>}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/5 cursor-pointer active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer active:scale-95 transition-all shadow-lg shadow-indigo-600/20"
                >
                  {addLoading ? "추가 중..." : "종목 추가"}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-300">
          <div className="w-full max-w-md p-6 rounded-2xl glass-panel border border-white/10 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-white tracking-wide mb-2">⚙️ 보유 주식 수량 변경</h3>
            <p className="text-xs text-muted font-semibold mb-4">
              {editingItem.stockName} ({editingItem.ticker}) 종목의 잔고 보유 수량을 수정합니다.
            </p>

            <form onSubmit={handleEditStockSubmit} className="space-y-4">
              <div>
                <label htmlFor="editQuantity" className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1">
                  보유 수량
                </label>
                <input
                  type="number"
                  id="editQuantity"
                  required
                  min="1"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50 transition-colors font-mono font-bold"
                />
              </div>

              {editError && <p className="text-xs font-semibold text-red-400 text-center">{editError}</p>}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingItem(null);
                  }}
                  className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/5 cursor-pointer active:scale-95 transition-all"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 cursor-pointer active:scale-95 transition-all shadow-lg shadow-indigo-600/20"
                >
                  {editLoading ? "수정 중..." : "수정 완료"}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-300">
          <div className="w-full max-sm p-6 rounded-2xl glass-panel border border-red-500/10 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-red-400 tracking-wide mb-2 flex items-center gap-2">
              🚨 종목 삭제 확인
            </h3>
            <p className="text-xs text-muted font-semibold leading-relaxed mb-6">
              선택하신 보유 종목을 장부에서 삭제하시겠습니까? 삭제된 자산은 자산 통계 및 대시보드 연동에서 즉시 제거되며 복구할 수 없습니다.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteTargetId(null);
                }}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/5 cursor-pointer active:scale-95 transition-all"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteStockSubmit}
                disabled={deleteLoading}
                className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 cursor-pointer active:scale-95 transition-all shadow-lg shadow-red-600/20"
              >
                {deleteLoading ? "삭제 중..." : "장부에서 삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
