"use client";

import SalesTopProducts from "@/components/dashboard/sales/SalesTopProducts";
import type { SalesTopProduct } from "@/types/dashboardSales";

interface HomeTopProductsProps {
  products: SalesTopProduct[];
  periodLabel: string;
  loading?: boolean;
}

export default function HomeTopProducts({
  products,
  periodLabel,
  loading = false,
}: HomeTopProductsProps) {
  return (
    <div className="relative">
      <SalesTopProducts
        products={products}
        title={`인기 상품 Top 5 · ${periodLabel}`}
      />

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/60 pointer-events-none">
          <span className="sr-only">불러오는 중</span>
        </div>
      )}
    </div>
  );
}
