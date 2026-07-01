"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MemberTabs, { Member } from "@/components/MemberTabs";
import AccountCards, { AccountItem } from "@/components/AccountCards";
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

    async function loadAccounts() {
      setAccountsLoading(true);
      setSyncing(true);
      try {
        const response = await fetch(`/api/stock?memberId=${activeMemberId}`);
        const data = await response.json();
        if (data.success) {
          // Format accounts to match Component expectations
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

          if (formattedAccounts.length > 0) {
            setActiveAccountId(formattedAccounts[0].accountId);
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

    loadAccounts();
  }, [activeMemberId]);

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
    if (activeMemberId === null) return;
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
      }
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setSyncing(false);
    }
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
            <p className="text-[11px] text-muted font-medium mt-0.5">가족 멀티 계좌 관리 및 실시간 자산 배분 시스템</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh/Sync button */}
          <button
            type="button"
            disabled={syncing || accountsLoading}
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-white disabled:opacity-50 cursor-pointer active:scale-95 transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            {syncing ? "동기화 중..." : "실시간 동기화"}
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
              <span className="text-[10px] font-semibold text-muted uppercase tracking-wider block">동기화 시점</span>
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
            {activeAccount && !activeAccount.synced && (
              <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 animate-pulse">
                네트워크/점검 에러로 인한 오프라인 캐시 노출 중
              </span>
            )}
          </div>
          <StockTable
            balances={activeAccount ? activeAccount.balances : []}
            isLoading={accountsLoading}
          />
        </div>
      </section>
    </div>
  );
}
