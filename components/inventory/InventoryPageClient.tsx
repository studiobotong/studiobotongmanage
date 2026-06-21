"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Package,
  ClipboardList,
  RotateCcw,
  Truck,
  SlidersHorizontal,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import clsx from "clsx";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import Card from "@/components/Card";
import StockAdjustModal from "@/components/inventory/StockAdjustModal";
import { getProducts } from "@/lib/products";
import { adjustStock, getMovementLabel, getStockMovements } from "@/lib/inventory";
import type { BotongProduct } from "@/types/products";
import type { StockAdjustType, StockMovement } from "@/types/inventory";

type StockStatus = "정상" | "부족" | "품절";

function getStockStatus(product: BotongProduct): StockStatus {
  if (product.stock_qty <= 0) return "품절";
  if (product.stock_qty <= product.safety_stock) return "부족";
  return "정상";
}

const statusStyle: Record<
  StockStatus,
  { badge: string; icon: React.ElementType; iconColor: string }
> = {
  정상: {
    badge: "bg-emerald-50 text-emerald-600",
    icon: CheckCircle2,
    iconColor: "text-emerald-400",
  },
  부족: {
    badge: "bg-amber-50 text-amber-600",
    icon: AlertTriangle,
    iconColor: "text-amber-400",
  },
  품절: {
    badge: "bg-red-50 text-red-600",
    icon: Package,
    iconColor: "text-red-400",
  },
};

const movementIcon: Record<string, React.ElementType> = {
  "실사 조정": ClipboardList,
  "불량품 차감": ArrowDownCircle,
  "반품 접수": RotateCcw,
  "신규 입고": Truck,
  "주문 출고": ArrowDownCircle,
  "주문 차감": ArrowDownCircle,
  "재고 복구": ArrowUpCircle,
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InventoryPageClient() {
  const [products, setProducts] = useState<BotongProduct[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adjustTarget, setAdjustTarget] = useState<BotongProduct | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [productRows, movementRows] = await Promise.all([
        getProducts(),
        getStockMovements({ limit: 50 }),
      ]);
      setProducts(productRows.filter((p) => p.is_active));
      setMovements(movementRows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.product_name.toLowerCase().includes(q) ||
        p.option_name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q)
    );
  }, [products, search]);

  const summary = useMemo(() => {
    let low = 0;
    for (const p of products) {
      const status = getStockStatus(p);
      if (status !== "정상") low += 1;
    }
    return { total: products.length, low, ok: products.length - low };
  }, [products]);

  const handleAdjust = async (payload: {
    type: StockAdjustType;
    targetQty?: number;
    quantity?: number;
    unitCost?: number;
    supplier?: string;
    purchaseMemo?: string;
    memo?: string;
    relatedOrderNo?: string;
    direction?: "increase" | "decrease";
  }) => {
    if (!adjustTarget) return;

    setSaving(true);
    try {
      const result = await adjustStock({
        productId: adjustTarget.id,
        ...payload,
      });

      if (!result.ok) {
        setToast({
          message: result.error ?? "재고 조정에 실패했습니다.",
          type: "error",
        });
        return;
      }

      setAdjustTarget(null);
      setToast({ message: "재고가 조정되었습니다.", type: "success" });
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header title="Inventory" subtitle="재고 현황 관리" />
      <div className="px-8 py-8">
        <PageHeader
          title="재고 관리"
          description="상품별 재고 현황을 확인하고 조정하세요"
        />

        <div className="mb-8 grid grid-cols-3 gap-4">
          {[
            {
              label: "전체 상품",
              value: `${summary.total}개`,
              bg: "bg-white",
              text: "text-gray-800",
            },
            {
              label: "재고 부족 / 품절",
              value: `${summary.low}개`,
              bg: "bg-amber-50",
              text: "text-amber-700",
            },
            {
              label: "정상 재고",
              value: `${summary.ok}개`,
              bg: "bg-emerald-50",
              text: "text-emerald-700",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`${stat.bg} rounded-2xl border border-gray-100 p-5 shadow-sm`}
            >
              <p className="text-xs font-medium text-gray-400">{stat.label}</p>
              <p className={`mt-1 text-2xl font-bold ${stat.text}`}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <Card className="mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">
                상품 검색
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="상품명, 옵션, SKU"
                  className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#5b6af4] focus:ring-2 focus:ring-[#5b6af4]/20"
                />
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={loading ? Loader2 : RefreshCw}
              onClick={() => void loadData()}
              className={loading ? "[&_svg]:animate-spin" : ""}
            >
              새로고침
            </Button>
          </div>
        </Card>

        <Card padding="sm" className="mb-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              불러오는 중...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">
              등록된 상품이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400">
                      상품명
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400">
                      SKU
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400">
                      현재 재고
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400">
                      안전 재고
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400">
                      상태
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400" />
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((item) => {
                    const status = getStockStatus(item);
                    const s = statusStyle[status];
                    const Icon = s.icon;
                    const percent = Math.min(
                      (item.stock_qty /
                        Math.max(item.safety_stock * 3, 1)) *
                        100,
                      100
                    );
                    const label = item.option_name
                      ? `${item.product_name} (${item.option_name})`
                      : item.product_name;

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-gray-50 transition-colors hover:bg-gray-50/60"
                      >
                        <td className="max-w-[280px] truncate px-3 py-3.5 text-sm font-medium text-gray-800">
                          {label}
                        </td>
                        <td className="px-3 py-3.5 font-mono text-xs text-gray-400">
                          {item.sku || "—"}
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="w-8 text-sm font-semibold text-gray-800">
                              {item.stock_qty}
                            </span>
                            <div className="h-1.5 max-w-20 flex-1 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className={clsx(
                                  "h-full rounded-full",
                                  status === "정상"
                                    ? "bg-emerald-400"
                                    : status === "부족"
                                      ? "bg-amber-400"
                                      : "bg-red-400"
                                )}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-xs text-gray-400">
                          {item.safety_stock}개
                        </td>
                        <td className="px-3 py-3.5">
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium",
                              s.badge
                            )}
                          >
                            <Icon className={clsx("h-3 w-3", s.iconColor)} />
                            {status}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAdjustTarget(item)}
                          >
                            조정
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card padding="sm">
          <div className="mb-4 px-2">
            <h3 className="text-sm font-semibold text-gray-700">
              최근 재고 이력
            </h3>
            <p className="mt-0.5 text-xs text-gray-400">
              stock_movements 최근 50건
            </p>
          </div>

          {movements.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              재고 이력이 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400">
                      일시
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400">
                      유형
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400">
                      상품
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-400">
                      변동
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-400">
                      잔량
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400">
                      메모
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => {
                    const label = getMovementLabel(m);
                    const MoveIcon =
                      movementIcon[label] ?? SlidersHorizontal;
                    const productLabel = m.option_name
                      ? `${m.product_name} (${m.option_name})`
                      : (m.product_name ?? "—");

                    return (
                      <tr
                        key={m.id}
                        className="border-b border-gray-50 hover:bg-gray-50/60"
                      >
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500">
                          {formatDate(m.created_at)}
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600">
                            <MoveIcon className="h-3 w-3 text-gray-400" />
                            {label}
                          </span>
                        </td>
                        <td className="max-w-[200px] truncate px-3 py-3 text-xs text-gray-600">
                          {productLabel}
                        </td>
                        <td
                          className={clsx(
                            "px-3 py-3 text-right text-sm font-semibold",
                            m.quantity_change > 0
                              ? "text-emerald-600"
                              : m.quantity_change < 0
                                ? "text-red-500"
                                : "text-gray-500"
                          )}
                        >
                          {m.quantity_change > 0 ? "+" : ""}
                          {m.quantity_change}
                        </td>
                        <td className="px-3 py-3 text-right text-sm text-gray-600">
                          {m.balance_after}
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-3 text-xs text-gray-400">
                          {m.note || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {adjustTarget && (
        <StockAdjustModal
          product={adjustTarget}
          saving={saving}
          onConfirm={(payload) => void handleAdjust(payload)}
          onClose={() => {
            if (!saving) setAdjustTarget(null);
          }}
        />
      )}

      {toast && (
        <div
          className={clsx(
            "fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg",
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-500 text-white"
          )}
        >
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-3 opacity-70 hover:opacity-100"
          >
            닫기
          </button>
        </div>
      )}
    </>
  );
}
