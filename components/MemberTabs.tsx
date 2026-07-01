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
    <div className="flex gap-1.5 p-1 bg-white/5 rounded-xl border border-border w-max max-w-full overflow-x-auto scrollbar-none">
      {members.map((member) => {
        const isActive = member.id === activeMemberId;
        return (
          <button
            key={member.id}
            type="button"
            onClick={() => onChange(member.id)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-300 relative cursor-pointer ${
              isActive
                ? "bg-primary text-white shadow-md shadow-indigo-500/20"
                : "text-muted hover:text-white hover:bg-white/5"
            }`}
          >
            {/* Soft micro-animation dot */}
            {isActive && (
              <span className="absolute -top-0.5 -right-0.5 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400"></span>
              </span>
            )}
            {member.name}
          </button>
        );
      })}
    </div>
  );
}
