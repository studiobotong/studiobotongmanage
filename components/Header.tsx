"use client";

import { Bell, Search, ChevronDown } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header({ title, subtitle }: HeaderProps) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="flex items-center justify-between px-8 py-4">
        {/* Page Title */}
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-3">
          {/* Date */}
          <span className="hidden md:block text-xs text-gray-400">{dateStr}</span>

          {/* Search */}
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-gray-400 text-xs hover:bg-gray-100 transition-colors">
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:block">검색...</span>
            <span className="hidden sm:block text-[10px] bg-gray-200 px-1.5 py-0.5 rounded font-mono">⌘K</span>
          </button>

          {/* Notifications */}
          <button className="relative w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-colors">
            <Bell className="w-3.5 h-3.5 text-gray-500" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#5b6af4]" />
          </button>

          {/* Avatar */}
          <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#5b6af4] to-[#818cf8] flex items-center justify-center text-white text-[10px] font-semibold">
              A
            </div>
            <span className="text-xs font-medium text-gray-700 hidden sm:block">관리자</span>
            <ChevronDown className="w-3 h-3 text-gray-400 hidden sm:block" />
          </button>
        </div>
      </div>
    </header>
  );
}
