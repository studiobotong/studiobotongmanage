"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { BulkStockDeductionSummary } from "@/types/orders";

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

interface OrderBulkDeleteModalProps {
  open: boolean;
  selectedCount: number;
  productOrderNos: string[];
  deleting: boolean;
  onConfirm: (restoreStock: boolean) => void;
  onCancel: () => void;
}

export default function OrderBulkDeleteModal({
  open,
  selectedCount,
  productOrderNos,
  deleting,
  onConfirm,
  onCancel,
}: OrderBulkDeleteModalProps) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<BulkStockDeductionSummary | null>(
    null
  );
  const [restoreStock, setRestoreStock] = useState(false);

  useEffect(() => {
    if (!open) {
      setLoading(true);
      setSummary(null);
      setRestoreStock(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/orders/stock-deductions/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productOrderNos }),
          signal: controller.signal,
        });
        const json = (await res.json()) as {
          ok?: boolean;
          summary?: BulkStockDeductionSummary;
        };

        if (!cancelled) {
          setSummary(json.ok ? (json.summary ?? null) : null);
        }
      } catch (e) {
        if (!cancelled && !isAbortError(e)) {
          setSummary(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [open, productOrderNos]);

  if (!open) return null;

  const ordersWithDeductions = summary?.ordersWithDeductions ?? 0;
  const hasDeductions = ordersWithDeductions > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-delete-title"
    >
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3
              id="bulk-delete-title"
              className="text-sm font-bold text-gray-800"
            >
              선택 항목 일괄 삭제
            </h3>
            <p className="mt-0.5 text-xs text-gray-400">
              이 작업은 되돌릴 수 없습니다
            </p>
          </div>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          선택한 <span className="font-semibold">{selectedCount}건</span>의
          주문을 삭제하시겠습니까?
        </p>

        {loading ? (
          <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            재고 차감 이력 확인 중...
          </div>
        ) : hasDeductions ? (
          <div className="mb-6 space-y-3">
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
              <p className="text-xs font-medium text-amber-700">
                선택한 {selectedCount}건 중 {ordersWithDeductions}건이 재고를
                차감했습니다
              </p>
            </div>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-gray-200 px-3 py-2.5 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={restoreStock}
                onChange={(e) => setRestoreStock(e.target.checked)}
                disabled={deleting}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#5b6af4] focus:ring-[#5b6af4]/20"
              />
              <span className="text-sm text-gray-700">
                재고를 모두 되돌릴까요?
                <span className="mt-0.5 block text-xs text-gray-400">
                  선택 시 재고 차감 이력이 있는 주문마다 차감 수량을 복구합니다
                </span>
              </span>
            </label>
          </div>
        ) : (
          <div className="mb-6 rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
            선택한 주문 중 재고 차감 이력이 있는 건이 없습니다.
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onConfirm(restoreStock)}
            disabled={deleting || loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-600 disabled:opacity-50"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {selectedCount}건 삭제
          </button>
        </div>
      </div>
    </div>
  );
}
