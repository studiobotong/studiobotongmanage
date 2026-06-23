import clsx from "clsx";
import type { SalesKpi } from "@/types/dashboardSales";

function formatKrw(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function formatChangePct(pct: number | null): string {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

interface KpiCardProps {
  label: string;
  value: string;
  changePct: number | null;
}

function KpiCard({ label, value, changePct }: KpiCardProps) {
  const isUp = changePct != null && changePct > 0;
  const isDown = changePct != null && changePct < 0;

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
      <p className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-2">{label}</p>
      <p
        className={clsx(
          "text-xs font-medium tabular-nums mt-2",
          isUp && "text-[#2563EB]",
          isDown && "text-red-400",
          !isUp && !isDown && "text-gray-400"
        )}
      >
        전 기간 대비 {formatChangePct(changePct)}
      </p>
    </div>
  );
}

interface SalesKpiCardsProps {
  kpi: SalesKpi;
}

export default function SalesKpiCards({ kpi }: SalesKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="기간 매출 합계"
        value={formatKrw(kpi.totalSales)}
        changePct={kpi.salesChangePct}
      />
      <KpiCard
        label="기간 순이익 합계"
        value={formatKrw(kpi.totalProfit)}
        changePct={kpi.profitChangePct}
      />
      <KpiCard
        label="총 주문 건수"
        value={`${kpi.orderCount.toLocaleString("ko-KR")}건`}
        changePct={kpi.orderCountChangePct}
      />
      <KpiCard
        label="평균 주문 금액"
        value={formatKrw(Math.round(kpi.avgOrderAmount))}
        changePct={kpi.avgOrderChangePct}
      />
    </div>
  );
}
