import Link from "next/link";
import StatsCard from "@/components/StatsCard";
import {
  TrendingUp,
  ShoppingCart,
  Package,
  Users,
  AlertTriangle,
  Wallet,
  Megaphone,
} from "lucide-react";
import type { DashboardKpi } from "@/types/dashboard";

function formatChangePct(pct: number | null): string {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}% 직전 동일 기간 대비`;
}

function changeType(pct: number | null): "up" | "down" | "neutral" {
  if (pct == null || pct === 0) return "neutral";
  return pct > 0 ? "up" : "down";
}

function formatProductDelta(delta: number): string {
  if (delta === 0) return "직전 동일 기간과 동일";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta}종 직전 동일 기간 대비`;
}

interface DashboardKpiCardsProps {
  kpi: DashboardKpi;
}

export default function DashboardKpiCards({ kpi }: DashboardKpiCardsProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          title="기간 매출"
          value={kpi.periodSales.toLocaleString("ko-KR")}
          suffix="원"
          change={formatChangePct(kpi.periodSalesChangePct)}
          changeType={changeType(kpi.periodSalesChangePct)}
          icon={TrendingUp}
        />
        <StatsCard
          title="순이익"
          value={Math.round(kpi.periodProfit).toLocaleString("ko-KR")}
          suffix="원"
          change={formatChangePct(kpi.periodProfitChangePct)}
          changeType={changeType(kpi.periodProfitChangePct)}
          icon={Wallet}
          iconColor="text-teal-600"
          iconBg="bg-teal-50"
        />
        <StatsCard
          title="총 주문 수"
          value={kpi.orderCount.toLocaleString("ko-KR")}
          suffix="건"
          change={formatChangePct(kpi.orderCountChangePct)}
          changeType={changeType(kpi.orderCountChangePct)}
          icon={ShoppingCart}
          iconColor="text-blue-500"
          iconBg="bg-blue-50"
        />
        <StatsCard
          title="판매 상품 수"
          value={String(kpi.productCount)}
          suffix="종"
          change={formatProductDelta(kpi.productCountDelta)}
          changeType={
            kpi.productCountDelta > 0
              ? "up"
              : kpi.productCountDelta < 0
                ? "down"
                : "neutral"
          }
          icon={Package}
          iconColor="text-purple-500"
          iconBg="bg-purple-50"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatsCard
          title="평균 주문 금액"
          value={Math.round(kpi.avgOrderAmount).toLocaleString("ko-KR")}
          suffix="원"
          change={formatChangePct(kpi.avgOrderChangePct)}
          changeType={changeType(kpi.avgOrderChangePct)}
          icon={Users}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-50"
        />
        <StatsCard
          title="광고비 합계"
          value={kpi.adSpend.toLocaleString("ko-KR")}
          suffix="원"
          change={formatChangePct(kpi.adSpendChangePct)}
          changeType={changeType(kpi.adSpendChangePct)}
          icon={Megaphone}
          iconColor="text-rose-500"
          iconBg="bg-rose-50"
        />
        <Link href="/inventory" className="block">
          <StatsCard
            title="발주 필요 상품 수"
            value={kpi.reorderProductCount.toLocaleString("ko-KR")}
            suffix="개"
            change="재고 관리로 이동 →"
            changeType="neutral"
            icon={AlertTriangle}
            iconColor="text-amber-500"
            iconBg="bg-amber-50"
          />
        </Link>
      </div>
    </div>
  );
}
