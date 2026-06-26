"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BoxesIcon,
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
  ClipboardList,
  Landmark,
  Receipt,
  ShoppingBag,
} from "lucide-react";
import { clsx } from "clsx";
import { logout } from "@/app/actions/auth";

const navItems = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Sales",
    href: "/sales",
    icon: ShoppingCart,
  },
  {
    label: "주문 관리",
    href: "/orders",
    icon: ClipboardList,
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: BoxesIcon,
  },
  {
    label: "상품 관리",
    href: "/products",
    icon: Package,
  },
  {
    label: "Analytics",
    href: "/stats",
    icon: BarChart3,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
  {
    label: "정산내역",
    href: "/settlements",
    icon: Receipt,
  },
  {
    label: "플리마켓",
    href: "/flea-market",
    icon: ShoppingBag,
  },
  {
    label: "Asset",
    href: "/assets",
    icon: Landmark,
  },
];

type SidebarProps = {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
};

export default function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();

  const handleNavClick = () => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      onMobileClose?.();
    }
  };

  return (
    <aside
      id="mobile-sidebar-nav"
      className={clsx(
        "fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-gray-100 bg-white md:z-30",
        "shadow-lg md:shadow-none",
        "transition-transform duration-300 ease-out",
        isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        isMobileOpen ? "pointer-events-auto" : "pointer-events-none md:pointer-events-auto"
      )}
    >
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2.5 group" onClick={handleNavClick}>
          <div className="w-8 h-8 rounded-xl bg-[#5b6af4] flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 leading-tight">스튜디오 보통</p>
            <p className="text-[10px] text-gray-400 leading-tight">Admin Dashboard</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-none">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
          Menu
        </p>
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={handleNavClick}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-[#eef0fe] text-[#5b6af4]"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                  )}
                >
                  <Icon
                    className={clsx(
                      "w-4 h-4 flex-shrink-0",
                      isActive ? "text-[#5b6af4]" : "text-gray-400"
                    )}
                  />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#5b6af4]" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom: User + Logout */}
      <div className="px-3 pb-4 border-t border-gray-100 pt-3">
        <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#5b6af4] to-[#818cf8] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            A
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">관리자</p>
            <p className="text-[10px] text-gray-400 truncate">admin@botong.kr</p>
          </div>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-500 w-full transition-all duration-150"
          >
            <LogOut className="w-4 h-4 text-gray-400" />
            <span>Logout</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
