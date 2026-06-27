"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Loader2, Package, AlertTriangle } from "lucide-react";
import clsx from "clsx";
import Header from "@/components/Header";
import Button from "@/components/Button";
import Card from "@/components/Card";
import { updateProductSortOrder } from "@/lib/btmCost";

interface BTMProduct {
  id: number;
  product_id: string;
  product_name: string;
  status: string;
  sale_price: number;
  thumbnail_url: string | null;
  updated_at: string;
  sort_order?: number;
}

interface BTMProductOption {
  id: number;
  product_id: string;
  option_code: string;
  option_name: string;
  selling_price: number;
  cost_price: number;
  stock_quantity: number;
  safety_stock: number;
  is_active: boolean;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  SALE:        { label: "판매중",  color: "bg-emerald-50 text-emerald-600" },
  SUSPENSION:  { label: "판매중지", color: "bg-red-50 text-red-500" },
  OUTOFSTOCK:  { label: "품절",    color: "bg-orange-50 text-orange-500" },
  WAIT:        { label: "대기",    color: "bg-gray-50 text-gray-400" },
};

export default function ProductsPageClient() {
  const [products, setProducts] = useState<BTMProduct[]>([]);
  const [optionsMap, setOptionsMap] = useState<Record<string, BTMProductOption[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [hideOutOfStock, setHideOutOfStock] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { btmSupabase } = await import("@/lib/btmSupabaseClient");
      const { data } = await btmSupabase
        .from("btm_products")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("product_name", { ascending: true });
      setProducts((data ?? []) as BTMProduct[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  const loadOptions = async (productId: string) => {
    if (optionsMap[productId]) return;
    const { btmSupabase } = await import("@/lib/btmSupabaseClient");
    const { data } = await btmSupabase
      .from("btm_product_options")
      .select("*")
      .eq("product_id", productId)
      .order("option_name", { ascending: true });
    setOptionsMap(prev => ({ ...prev, [productId]: (data ?? []) as BTMProductOption[] }));
  };

  const handleExpand = async (productId: string) => {
    if (expandedId === productId) {
      setExpandedId(null);
    } else {
      setExpandedId(productId);
      await loadOptions(productId);
    }
  };

  const handleSync = async () => {
    if (!confirm("네이버 스마트스토어에서 전체 상품·옵션·재고를 동기화합니다.\n약 10~30초 소요됩니다.")) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/cron/sync-products", {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? "btm_cron_secret_2026"}` },
      });
      const json = await res.json();
      if (json.ok) {
        setToast({ msg: `상품 ${json.result.productsUpserted}개, 옵션 ${json.result.optionsUpserted}개 동기화 완료`, ok: true });
        setOptionsMap({});
        await loadProducts();
      } else {
        setToast({ msg: json.error ?? "동기화 실패", ok: false });
      }
    } catch {
      setToast({ msg: "동기화 중 오류가 발생했습니다.", ok: false });
    } finally {
      setSyncing(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  const handleCostEdit = async (opt: BTMProductOption, newCost: number) => {
    const { btmSupabase } = await import("@/lib/btmSupabaseClient");
    await btmSupabase
      .from("btm_product_options")
      .update({ cost_price: newCost })
      .eq("id", opt.id);
    setOptionsMap(prev => ({
      ...prev,
      [opt.product_id]: (prev[opt.product_id] ?? []).map(o =>
        o.id === opt.id ? { ...o, cost_price: newCost } : o
      ),
    }));
  };

  const handleSafetyEdit = async (opt: BTMProductOption, newSafety: number) => {
    const { btmSupabase } = await import("@/lib/btmSupabaseClient");
    await btmSupabase
      .from("btm_product_options")
      .update({ safety_stock: newSafety })
      .eq("id", opt.id);
    setOptionsMap(prev => ({
      ...prev,
      [opt.product_id]: (prev[opt.product_id] ?? []).map(o =>
        o.id === opt.id ? { ...o, safety_stock: newSafety } : o
      ),
    }));
  };

  const filteredProducts = showAll
    ? products
    : products.filter(p => {
        if (hideOutOfStock && (p.status === "OUTOFSTOCK" || p.status === "SUSPENSION")) return false;
        return true;
      });

  const totalProducts = products.length;
  const saleProducts = products.filter(p => p.status === "SALE").length;
  const lowStockCount = Object.values(optionsMap).flat().filter(
    o => o.stock_quantity <= o.safety_stock && o.safety_stock > 0
  ).length;

  return (
    <>
      <Header title="상품 관리" subtitle="네이버 스마트스토어 상품 및 재고" />
      <div className="px-4 sm:px-6 lg:px-8 py-6">

        {/* KPI 카드 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "전체 상품", value: totalProducts, unit: "개" },
            { label: "판매중", value: saleProducts, unit: "개" },
            { label: "발주 필요", value: lowStockCount, unit: "개" },
          ].map(({ label, value, unit }) => (
            <Card key={label} className="text-center py-3">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="text-2xl font-bold text-gray-800">{value}<span className="text-sm font-normal ml-0.5 text-gray-400">{unit}</span></p>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={hideOutOfStock}
                onChange={e => { setHideOutOfStock(e.target.checked); setShowAll(false); }}
                className="w-4 h-4 rounded accent-[#5b6af4]"
              />
              <span className="text-sm text-gray-600">품절·판매중지 숨기기</span>
            </label>
            <button
              onClick={() => setShowAll(v => !v)}
              className={clsx(
                "text-xs px-3 py-1.5 rounded-lg border transition-colors",
                showAll
                  ? "bg-[#5b6af4] text-white border-[#5b6af4]"
                  : "bg-white text-gray-500 border-gray-200 hover:border-[#5b6af4]"
              )}
            >
              {showAll ? "전체 보기 중" : "전체 보기"}
            </button>
          </div>
          <Button variant="primary" size="sm" onClick={handleSync} disabled={syncing}
            icon={syncing ? Loader2 : RefreshCw}
            className={syncing ? "[&_svg]:animate-spin" : ""}>
            {syncing ? "동기화 중..." : "네이버 상품 동기화"}
          </Button>
        </div>

        {/* 상품 목록 */}
        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">불러오는 중…</span>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">상품이 없습니다.</p>
              <p className="text-xs text-gray-300 mt-1">우측 상단 &quot;네이버 상품 동기화&quot; 버튼을 눌러주세요.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredProducts.map(product => {
                const statusInfo = STATUS_LABEL[product.status] ?? { label: product.status, color: "bg-gray-50 text-gray-400" };
                const opts = optionsMap[product.product_id] ?? [];
                const isExpanded = expandedId === product.product_id;
                const hasLowStock = opts.some(o => o.stock_quantity <= o.safety_stock && o.safety_stock > 0);

                return (
                  <div key={product.product_id}>
                    <div className="w-full px-4 py-3.5 hover:bg-gray-50/60 flex items-center gap-3 transition-colors">
                      <button
                        className="flex-1 text-left flex items-center gap-3 min-w-0"
                        onClick={() => handleExpand(product.product_id)}
                      >
                        {product.thumbnail_url ? (
                          <img src={product.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 flex items-center justify-center">
                            <Package className="w-5 h-5 text-gray-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-medium text-gray-800 truncate">{product.product_name}</p>
                            {hasLowStock && <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-gray-400">{product.sale_price.toLocaleString()}원</p>
                        </div>
                      </button>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className={clsx("text-[10px] font-medium px-2 py-0.5 rounded-full", statusInfo.color)}>
                          {statusInfo.label}
                        </span>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const idx = products.findIndex(p => p.product_id === product.product_id);
                            if (idx <= 0) return;
                            const prev = products[idx - 1]!;
                            await Promise.all([
                              updateProductSortOrder(product.product_id, prev.sort_order ?? idx - 1),
                              updateProductSortOrder(prev.product_id, product.sort_order ?? idx),
                            ]);
                            await loadProducts();
                          }}
                          className="text-gray-300 hover:text-gray-500 text-xs px-1"
                          title="위로">↑</button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const idx = products.findIndex(p => p.product_id === product.product_id);
                            if (idx >= products.length - 1) return;
                            const next = products[idx + 1]!;
                            await Promise.all([
                              updateProductSortOrder(product.product_id, next.sort_order ?? idx + 1),
                              updateProductSortOrder(next.product_id, product.sort_order ?? idx),
                            ]);
                            await loadProducts();
                          }}
                          className="text-gray-300 hover:text-gray-500 text-xs px-1"
                          title="아래로">↓</button>
                      </div>
                    </div>

                    {/* 옵션 패널 */}
                    {isExpanded && (
                      <div className="bg-gray-50/60 border-t border-gray-100 px-4 py-3">
                        {opts.length === 0 ? (
                          <p className="text-xs text-gray-400 py-2">옵션 정보를 불러오는 중...</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-400">
                                  <th className="text-left py-1.5 pr-3 font-medium">옵션명</th>
                                  <th className="text-right py-1.5 pr-3 font-medium">재고</th>
                                  <th className="text-right py-1.5 pr-3 font-medium">원가</th>
                                  <th className="text-right py-1.5 font-medium">안전재고</th>
                                </tr>
                              </thead>
                              <tbody>
                                {opts.map(opt => {
                                  const isLow = opt.safety_stock > 0 && opt.stock_quantity <= opt.safety_stock;
                                  return (
                                    <tr key={opt.id} className={clsx("border-t border-gray-100", isLow && "bg-orange-50/50")}>
                                      <td className="py-2 pr-3 text-gray-700 max-w-[180px]">
                                        <p className="truncate">{opt.option_name}</p>
                                        <p className="text-gray-300 text-[10px]">{opt.option_code}</p>
                                      </td>
                                      <td className={clsx("py-2 pr-3 text-right font-medium", isLow ? "text-orange-500" : "text-gray-700")}>
                                        {opt.stock_quantity}
                                      </td>
                                      <td className="py-2 pr-3 text-right">
                                        <input
                                          type="number"
                                          defaultValue={opt.cost_price}
                                          onBlur={e => {
                                            const v = parseInt(e.target.value);
                                            if (!isNaN(v) && v !== opt.cost_price) handleCostEdit(opt, v);
                                          }}
                                          className="w-20 text-right border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:border-[#5b6af4]"
                                        />
                                      </td>
                                      <td className="py-2 text-right">
                                        <input
                                          type="number"
                                          defaultValue={opt.safety_stock}
                                          onBlur={e => {
                                            const v = parseInt(e.target.value);
                                            if (!isNaN(v) && v !== opt.safety_stock) handleSafetyEdit(opt, v);
                                          }}
                                          className="w-16 text-right border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:border-[#5b6af4]"
                                        />
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className={clsx(
          "fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg z-50 transition-all",
          toast.ok ? "bg-gray-900 text-white" : "bg-red-500 text-white"
        )}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
