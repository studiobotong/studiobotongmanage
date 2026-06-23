"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { SalesCategorySlice } from "@/types/dashboardSales";

const COLORS = [
  "#2563EB",
  "#60A5FA",
  "#93C5FD",
  "#BFDBFE",
  "#DBEAFE",
  "#9CA3AF",
];

function formatKrw(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

interface SalesCategoryDonutProps {
  categories: SalesCategorySlice[];
  showList?: boolean;
}

export default function SalesCategoryDonut({
  categories,
  showList = false,
}: SalesCategoryDonutProps) {
  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 sm:p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          카테고리별 매출 비중
        </h3>
        <p className="text-sm text-gray-400 text-center py-8">
          카테고리 데이터가 없습니다
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        카테고리별 매출 비중
      </h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={categories}
              dataKey="sales"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
            >
              {categories.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, item) => {
                const pct = (item?.payload as SalesCategorySlice)?.pct ?? 0;
                return [`${formatKrw(Number(value))} (${pct.toFixed(1)}%)`, "매출"];
              }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #E5E7EB",
                fontSize: 13,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => (
                <span className="text-gray-600">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {showList && (
        <ul className="mt-4 space-y-2 border-t border-gray-50 pt-4">
        {categories.map((c, i) => (
          <li
            key={c.category}
            className="flex items-center justify-between gap-3 text-sm"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-gray-700 truncate">{c.category}</span>
            </div>
            <div className="text-right flex-shrink-0 tabular-nums">
              <span className="text-gray-800 font-medium">
                {formatKrw(c.sales)}
              </span>
              <span className="text-gray-400 text-xs ml-2">
                {c.pct.toFixed(1)}%
              </span>
            </div>
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}
