"use client";

import { useCallback, useEffect, useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setIsSidebarOpen((o) => !o), []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setIsSidebarOpen(false);
    };
    mq.addEventListener("change", onChange);
    onChange();
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSidebar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSidebarOpen, closeSidebar]);

  return (
    <>
      {/* Mobile overlay — outside flex so it is not a flex item */}
      <button
        type="button"
        aria-label="Close menu"
        className={[
          "fixed inset-0 z-40 bg-black/50 md:hidden",
          "transition-opacity duration-300 ease-out",
          isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={closeSidebar}
      />

      <Sidebar isMobileOpen={isSidebarOpen} onMobileClose={closeSidebar} />

      <div className="flex h-screen min-h-0 bg-[#f8f9fb]">
        {/* Desktop: reserve 256px (w-64) so content aligns with fixed sidebar; mobile: no width */}
        <div
          className="hidden md:flex md:h-full md:w-64 md:flex-shrink-0"
          aria-hidden="true"
        />

        <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-x-hidden">
          <header className="flex shrink-0 items-center gap-3 border-b border-gray-100 bg-[#f8f9fb] px-4 py-3 md:hidden">
            <button
              type="button"
              aria-expanded={isSidebarOpen}
              aria-controls="mobile-sidebar-nav"
              className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
              onClick={toggleSidebar}
            >
              <Menu className="h-6 w-6" />
            </button>
            <span className="text-sm font-semibold text-gray-900">스튜디오 보통</span>
          </header>
          <main className="min-h-0 min-w-0 w-full max-w-full flex-1 overflow-x-hidden overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
