"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { getOrderStockDeductions } from "@/lib/orders";
import type { BotongOrder, OrderStockDeduction } from "@/types/orders";

function formatProductLabel(d: OrderStockDeduction): string {
  if (d.option_name) {
    return `${d.product_name} (${d.option_name})`;
  }
  return d.product_name;
}

interface OrderDeleteModalProps {
  order: BotongOrder;
  deleting: boolean;
  onConfirm: (restoreStock: boolean) => void;
  onCancel: () => void;
}

export default function OrderDeleteModal({
  order,
  deleting,
  onConfirm,
  onCancel,
}: OrderDeleteModalProps) {
  const [loading, setLoading] = useState(true);
  const [deductions, setDeductions] = useState<OrderStockDeduction[]>([]);
  const [restoreStock, setRestoreStock] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const rows = await getOrderStockDeductions(order.product_order_no);
        if (!cancelled) {
          setDeductions(rows);
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
    };
  }, [order.product_order_no]);

  const hasDeductions = deductions.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-delete-title"
    >
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3
              id="order-delete-title"
              className="text-sm font-bold text-gray-800"
            >
              주문 삭제
            </h3>
            <p className="mt-0.5 text-xs text-gray-400">
              이 작업은 되돌릴 수 없습니다
            </p>
          </div>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          이 주문을 삭제하시겠습니까?
        </p>

        <div className="mb-4 rounded-xl bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
          <p className="font-medium text-gray-700">{order.product_name}</p>
          {order.option_name && <p className="mt-0.5">{order.option_name}</p>}
          <p className="mt-1 text-gray-400">
            상품주문번호 {order.product_order_no}
          </p>
        </div>

        {loading ? (
          <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            재고 차감 이력 확인 중...
          </div>
        ) : hasDeductions ? (
          <div className="mb-6 space-y-3">
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
              <p className="text-xs font-medium text-amber-700">
                이 주문으로 재고가 차감된 기록이 있습니다
              </p>
              <ul className="mt-2 space-y-1">
                {deductions.map((d) => (
                  <li key={d.product_id} className="text-xs text-amber-800">
                    {formatProductLabel(d)} {d.quantity}개가 이 주문으로
                    차감되었습니다
                  </li>
                ))}
              </ul>
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
                재고 되돌리기
                <span className="mt-0.5 block text-xs text-gray-400">
                  선택 시 차감된 수량만큼 현재 재고에 다시 더합니다
                </span>
              </span>
            </label>
          </div>
        ) : (
          <div className="mb-6" />
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
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}
