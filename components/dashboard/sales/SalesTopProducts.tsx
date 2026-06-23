import type { ReactNode } from "react";
import type { SalesTopProduct } from "@/types/dashboardSales";

const ACCENT = "#2563EB";

function formatKrw(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

interface SalesTopProductsProps {
  products: SalesTopProduct[];
  title?: string;
  subtitle?: string;
  showProfit?: boolean;
  headerRight?: ReactNode;
}

export default function SalesTopProducts({
  products,
  title = "인기 상품 Top 5",
  subtitle,
  showProfit = false,
  headerRight,
}: SalesTopProductsProps) {
  const maxSales = products[0]?.totalSales ?? 1;

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {headerRight}
      </div>
      {products.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          해당 기간 주문 데이터가 없습니다
        </p>
      ) : (
        <ul className="space-y-4">
          {products.map((p) => (
            <li key={p.rank}>
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-gray-300 w-5">
                    {p.rank}
                  </span>
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {p.productName}
                  </span>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-gray-800 tabular-nums">
                    {p.orderCount}건
                  </p>
                  <p className="text-sm text-gray-800 tabular-nums font-semibold">
                    {formatKrw(p.totalSales)}
                  </p>
                  {showProfit && p.totalProfit != null && (
                    <p className="text-xs text-emerald-600 tabular-nums">
                      순이익 {formatKrw(p.totalProfit)}
                    </p>
                  )}
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(p.totalSales / maxSales) * 100}%`,
                    backgroundColor: ACCENT,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
