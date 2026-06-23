import clsx from "clsx";
import type { MarketingKpi } from "@/types/adReports";

function formatKrw(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function formatPct(n: number | null, suffix = "%"): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}${suffix}`;
}

function formatChangePct(pct: number | null): string {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

interface KpiCardProps {
  label: string;
  value: string;
  changePct?: number | null;
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
      {changePct !== undefined && (
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
      )}
    </div>
  );
}

interface MarketingKpiCardsProps {
  kpi: MarketingKpi;
}

export default function MarketingKpiCards({ kpi }: MarketingKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        label="총 광고비"
        value={formatKrw(kpi.totalSpend)}
        changePct={kpi.spendChangePct}
      />
      <KpiCard
        label="ROAS"
        value={formatPct(kpi.roas)}
        changePct={kpi.roasChangePct}
      />
      <KpiCard label="CPA" value={kpi.cpa != null ? formatKrw(kpi.cpa) : "—"} />
      <KpiCard label="CTR" value={formatPct(kpi.ctr)} />
    </div>
  );
}
