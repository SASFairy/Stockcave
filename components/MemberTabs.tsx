"use client";

export interface Member {
  id: number;
  name: string;
}

interface MemberTabsProps {
  members: Member[];
  activeMemberId: number | null;
  onChange: (id: number) => void;
  isLoading?: boolean;
}

export default function MemberTabs({ members, activeMemberId, onChange, isLoading = false }: MemberTabsProps) {
  if (isLoading) {
    return (
      <div className="flex gap-2 p-1.5 bg-white/5 rounded-xl border border-white/5 animate-pulse w-max">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-20 bg-white/10 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-1.5 p-1 bg-white/30 backdrop-blur-md rounded-xl border border-white/60 w-max max-w-full overflow-x-auto scrollbar-none shadow-sm">
      {members.map((member) => {
        const isActive = member.id === activeMemberId;
        return (
          <button
            key={member.id}
            type="button"
            onClick={() => onChange(member.id)}
            className={`px-5 py-2 rounded-lg text-sm font-extrabold transition-all duration-300 relative cursor-pointer ${
              isActive
                ? "bg-white text-slate-800 border border-slate-200/60 shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
            }`}
          >
            {/* Soft micro-animation dot */}
            {isActive && (
              <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-cyan-500/40 blur-[2px]"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500"></span>
              </span>
            )}
            {member.name}
          </button>
        );
      })}
    </div>
  );
}
