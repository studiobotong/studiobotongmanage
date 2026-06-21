"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import clsx from "clsx";
import type { BotongProduct } from "@/types/products";
import type { StockAdjustType } from "@/types/inventory";

const ADJUST_TYPES: {
  value: StockAdjustType;
  label: string;
  description: string;
}[] = [
  {
    value: "physical_count",
    label: "현재고 직접 입력",
    description: "실사 후 절대값으로 재고를 맞춥니다",
  },
  {
    value: "defect_out",
    label: "불량품 차감 (-)",
    description: "불량품 수량만큼 재고를 차감합니다",
  },
  {
    value: "return_in",
    label: "반품 접수 (+)",
    description: "반품된 상품을 재고에 추가합니다",
  },
  {
    value: "purchase_in",
    label: "신규 입고 (+)",
    description: "사입 기록과 함께 재고를 추가합니다",
  },
  {
    value: "other",
    label: "기타 조정 (+/-)",
    description: "증감 방향과 사유를 직접 입력합니다",
  },
];

interface StockAdjustModalProps {
  product: BotongProduct;
  saving: boolean;
  onConfirm: (payload: {
    type: StockAdjustType;
    targetQty?: number;
    quantity?: number;
    unitCost?: number;
    supplier?: string;
    purchaseMemo?: string;
    memo?: string;
    relatedOrderNo?: string;
    direction?: "increase" | "decrease";
  }) => void;
  onClose: () => void;
}

export default function StockAdjustModal({
  product,
  saving,
  onConfirm,
  onClose,
}: StockAdjustModalProps) {
  const [type, setType] = useState<StockAdjustType>("physical_count");
  const [targetQty, setTargetQty] = useState(String(product.stock_qty));
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState(
    product.cost_price > 0 ? String(product.cost_price) : ""
  );
  const [supplier, setSupplier] = useState("");
  const [purchaseMemo, setPurchaseMemo] = useState("");
  const [memo, setMemo] = useState("");
  const [relatedOrderNo, setRelatedOrderNo] = useState("");
  const [direction, setDirection] = useState<"increase" | "decrease">(
    "increase"
  );

  const handleSubmit = () => {
    onConfirm({
      type,
      targetQty: type === "physical_count" ? Number(targetQty) : undefined,
      quantity:
        type !== "physical_count" ? Number(quantity) : undefined,
      unitCost: type === "purchase_in" ? Number(unitCost) : undefined,
      supplier: type === "purchase_in" ? supplier : undefined,
      purchaseMemo: type === "purchase_in" ? purchaseMemo : undefined,
      memo:
        type === "defect_out" || type === "other" ? memo : undefined,
      relatedOrderNo: type === "return_in" ? relatedOrderNo : undefined,
      direction: type === "other" ? direction : undefined,
    });
  };

  const productLabel = product.option_name
    ? `${product.product_name} (${product.option_name})`
    : product.product_name;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="mx-4 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h3 className="text-sm font-bold text-gray-800">재고 조정</h3>
            <p className="mt-0.5 text-xs text-gray-400">{productLabel}</p>
            <p className="mt-1 text-xs text-gray-500">
              현재 재고:{" "}
              <span className="font-semibold text-gray-700">
                {product.stock_qty}개
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <p className="mb-2 text-xs font-medium text-gray-500">조정 유형</p>
          <div className="mb-4 space-y-1.5">
            {ADJUST_TYPES.map((item) => (
              <label
                key={item.value}
                className={clsx(
                  "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
                  type === item.value
                    ? "border-[#5b6af4] bg-[#eef0fe]"
                    : "border-gray-200 hover:bg-gray-50"
                )}
              >
                <input
                  type="radio"
                  name="adjustType"
                  value={item.value}
                  checked={type === item.value}
                  onChange={() => setType(item.value)}
                  disabled={saving}
                  className="mt-0.5 h-4 w-4 border-gray-300 text-[#5b6af4] focus:ring-[#5b6af4]/20"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-800">
                    {item.label}
                  </span>
                  <span className="block text-xs text-gray-400">
                    {item.description}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {type === "physical_count" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                실사 후 현재고
              </label>
              <input
                type="number"
                min={0}
                value={targetQty}
                onChange={(e) => setTargetQty(e.target.value)}
                disabled={saving}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#5b6af4] focus:ring-2 focus:ring-[#5b6af4]/20"
              />
              {targetQty !== "" && Number(targetQty) !== product.stock_qty && (
                <p className="mt-1.5 text-xs text-gray-500">
                  변동:{" "}
                  <span
                    className={clsx(
                      "font-semibold",
                      Number(targetQty) - product.stock_qty > 0
                        ? "text-emerald-600"
                        : "text-red-500"
                    )}
                  >
                    {Number(targetQty) - product.stock_qty > 0 ? "+" : ""}
                    {Number(targetQty) - product.stock_qty}개
                  </span>
                </p>
              )}
            </div>
          )}

          {(type === "defect_out" ||
            type === "return_in" ||
            type === "purchase_in" ||
            type === "other") && (
            <div className="space-y-3">
              {type === "other" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    조정 방향
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDirection("increase")}
                      disabled={saving}
                      className={clsx(
                        "flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                        direction === "increase"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      증가 (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection("decrease")}
                      disabled={saving}
                      className={clsx(
                        "flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                        direction === "decrease"
                          ? "border-red-300 bg-red-50 text-red-600"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      )}
                    >
                      감소 (-)
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">
                  수량
                </label>
                <input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#5b6af4] focus:ring-2 focus:ring-[#5b6af4]/20"
                />
              </div>

              {type === "purchase_in" && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      단가 (원)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={unitCost}
                      onChange={(e) => setUnitCost(e.target.value)}
                      disabled={saving}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#5b6af4] focus:ring-2 focus:ring-[#5b6af4]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      공급처 (선택)
                    </label>
                    <input
                      type="text"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      disabled={saving}
                      placeholder="공급처명"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#5b6af4] focus:ring-2 focus:ring-[#5b6af4]/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">
                      메모 (선택)
                    </label>
                    <input
                      type="text"
                      value={purchaseMemo}
                      onChange={(e) => setPurchaseMemo(e.target.value)}
                      disabled={saving}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#5b6af4] focus:ring-2 focus:ring-[#5b6af4]/20"
                    />
                  </div>
                </>
              )}

              {type === "return_in" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    관련 주문번호 (선택)
                  </label>
                  <input
                    type="text"
                    value={relatedOrderNo}
                    onChange={(e) => setRelatedOrderNo(e.target.value)}
                    disabled={saving}
                    placeholder="상품주문번호"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#5b6af4] focus:ring-2 focus:ring-[#5b6af4]/20"
                  />
                </div>
              )}

              {(type === "defect_out" || type === "other") && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    {type === "other" ? "조정 사유 (필수)" : "추가 메모 (선택)"}
                  </label>
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    disabled={saving}
                    placeholder={
                      type === "other" ? "조정 사유를 입력하세요" : "메모"
                    }
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-[#5b6af4] focus:ring-2 focus:ring-[#5b6af4]/20"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#5b6af4] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4a59e3] disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            조정 적용
          </button>
        </div>
      </div>
    </div>
  );
}
