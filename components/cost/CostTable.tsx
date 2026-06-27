"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import clsx from "clsx";
import Card from "@/components/Card";
import { getCostTable, updateCostPrice, updateLaborCost, updateProductSortOrder } from "@/lib/btmCost";
import type { BTMCostRow } from "@/lib/btmCost";
import OptionMaterialPanel from "./OptionMaterialPanel";

export default function CostTable() {
  const [rows, setRows]       = useState<BTMCostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [selectedRow, setSelectedRow]         = useState<BTMCostRow | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<{ product_id: string; product_name: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getCostTable();
    setRows(data);
    setSelectedRow(prev => prev ? (data.find(r => r.id === prev.id) ?? null) : null);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCostPriceBlur = async (row: BTMCostRow, val: string) => {
    const v = parseInt(val);
    if (!isNaN(v) && v !== row.cost_price) {
      await updateCostPrice(row.id, v, true);
      await load();
    }
  };

  const handleLaborBlur = async (row: BTMCostRow, val: string) => {
    const v = parseInt(val);
    if (!isNaN(v) && v !== row.labor_cost) {
      await updateLaborCost(row.id, v);
      await load();
    }
  };

  const filtered = rows.filter(r =>
    !search || r.product_name.includes(search) || r.option_name.includes(search)
  );

  // 상품별 그룹핑
  const grouped: Record<string, BTMCostRow[]> = {};
  for (const r of filtered) {
    (grouped[r.product_id] ??= []).push(r);
  }

  const productOrder = Object.keys(grouped).sort((a, b) => {
    const sa = rows.find(r => r.product_id === a)?.sort_order ?? 999;
    const sb = rows.find(r => r.product_id === b)?.sort_order ?? 999;
    return sa - sb;
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text" placeholder="상품명 검색" value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-4 py-2 text-sm border border-gray-200 rounded-xl w-52 focus:outline-none focus:border-[#5b6af4]"
          />
        </div>
        <span className="text-xs text-gray-400 ml-auto">공임비 클릭 후 수정 → Enter 또는 포커스 이동 시 저장</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /><span className="text-sm">불러오는 중…</span>
        </div>
      ) : (
        <div className="space-y-3">
          {productOrder.map(productId => {
            const opts = grouped[productId]!;
            return (
            <Card key={productId} className="overflow-hidden p-0">
              <div
                className="px-4 py-3 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-100/80 transition-colors"
              >
                <div
                  className="flex-1 flex items-center justify-between"
                  onClick={() => setSelectedProduct({ product_id: productId, product_name: opts[0]?.product_name ?? "" })}
                >
                  <p className="text-sm font-medium text-gray-800">{opts[0]?.product_name}</p>
                  <span className="text-xs text-gray-400 flex items-center gap-1 mr-3">
                    공통 부자재 <span className="text-gray-300">↗</span>
                  </span>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const idx = productOrder.indexOf(productId);
                      if (idx <= 0) return;
                      const prevId = productOrder[idx - 1]!;
                      const curSort = rows.find(r => r.product_id === productId)?.sort_order ?? idx;
                      const prevSort = rows.find(r => r.product_id === prevId)?.sort_order ?? idx - 1;
                      await Promise.all([
                        updateProductSortOrder(productId, prevSort),
                        updateProductSortOrder(prevId, curSort),
                      ]);
                      await load();
                    }}
                    className="px-1.5 py-0.5 rounded text-gray-400 hover:bg-gray-200 text-xs"
                    title="위로">↑</button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const idx = productOrder.indexOf(productId);
                      if (idx >= productOrder.length - 1) return;
                      const nextId = productOrder[idx + 1]!;
                      const curSort = rows.find(r => r.product_id === productId)?.sort_order ?? idx;
                      const nextSort = rows.find(r => r.product_id === nextId)?.sort_order ?? idx + 1;
                      await Promise.all([
                        updateProductSortOrder(productId, nextSort),
                        updateProductSortOrder(nextId, curSort),
                      ]);
                      await load();
                    }}
                    className="px-1.5 py-0.5 rounded text-gray-400 hover:bg-gray-200 text-xs"
                    title="아래로">↓</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400">
                      <th className="text-left px-4 py-2.5 font-medium">옵션명</th>
                      <th className="text-right px-3 py-2.5 font-medium">판매가</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-400">구매원가</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-400">공임비</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-400 bg-blue-50/50">최종원가</th>
                      <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-400">마진율</th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">재고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opts.map(row => {
                      const margin = row.selling_price > 0 && row.total_cost > 0
                        ? ((row.selling_price - row.total_cost) / row.selling_price * 100)
                        : 0;
                      const isLowMargin = margin > 0 && margin < 30;
                      return (
                        <tr
                          key={row.id}
                          className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer"
                          onClick={e => {
                            // input 클릭 시 패널 열리지 않도록
                            if ((e.target as HTMLElement).tagName === "INPUT") return;
                            setSelectedRow(row);
                          }}
                        >
                          <td className="px-4 py-2.5 text-gray-700">
                            <p className="flex items-center gap-1">
                              {row.option_name}
                              <span className="text-[10px] text-gray-300 ml-1">↗</span>
                            </p>
                            <p className="text-[10px] text-gray-300">{row.option_code}</p>
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600">
                            {row.selling_price.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                step="1"
                                defaultValue={row.cost_price}
                                onBlur={e => handleCostPriceBlur(row, e.target.value)}
                                className={clsx(
                                  "w-24 text-right border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-[#5b6af4]",
                                  row.is_manual_cost
                                    ? "bg-amber-50 border-amber-300 text-amber-800"
                                    : "bg-white border-gray-200"
                                )}
                                placeholder="0"
                              />
                              <label className="flex items-center gap-1 cursor-pointer flex-shrink-0" title="수동으로 직접 입력한 원가">
                                <input
                                  type="checkbox"
                                  checked={row.is_manual_cost ?? false}
                                  onChange={async (e) => {
                                    if (!e.target.checked) {
                                      const { btmSupabase } = await import("@/lib/btmSupabaseClient");
                                      await btmSupabase
                                        .from("btm_product_options")
                                        .update({ is_manual_cost: false })
                                        .eq("id", row.id);
                                      await load();
                                    }
                                  }}
                                  className="w-3 h-3 accent-amber-500"
                                />
                                <span className={clsx(
                                  "text-[10px] font-medium",
                                  row.is_manual_cost ? "text-amber-600" : "text-gray-300"
                                )}>
                                  수동입력
                                </span>
                              </label>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <input
                              type="number"
                              step="1"
                              defaultValue={row.labor_cost}
                              onBlur={e => handleLaborBlur(row, e.target.value)}
                              className="w-20 text-right border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:border-[#5b6af4]"
                            />
                          </td>
                          <td className={clsx(
                            "px-3 py-2.5 text-right font-medium text-sm bg-blue-50/30",
                            row.total_cost > 0 ? "text-[#5b6af4]" : "text-gray-300"
                          )}>
                            {row.total_cost > 0 ? row.total_cost.toLocaleString() : "—"}
                          </td>
                          <td className={clsx("px-3 py-2.5 text-right font-medium",
                            isLowMargin ? "text-red-500" : "text-emerald-600")}>
                            {row.selling_price > 0 && row.total_cost > 0
                              ? `${margin.toFixed(1)}%`
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-600">
                            {row.stock_quantity}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
            );
          })}
        </div>
      )}

      {selectedProduct && (
        <OptionMaterialPanel
          mode="product"
          productId={selectedProduct.product_id}
          productName={selectedProduct.product_name}
          onClose={() => setSelectedProduct(null)}
          onUpdated={() => void load()}
        />
      )}
      {selectedRow && !selectedProduct && (
        <OptionMaterialPanel
          mode="option"
          productId={selectedRow.product_id}
          productName={selectedRow.product_name}
          optionId={selectedRow.id}
          optionName={selectedRow.option_name}
          onClose={() => setSelectedRow(null)}
          onUpdated={() => void load()}
        />
      )}
    </div>
  );
}
