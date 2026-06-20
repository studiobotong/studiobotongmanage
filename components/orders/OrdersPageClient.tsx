"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Upload, Search, Loader2, RefreshCw, Trash2 } from "lucide-react";
import clsx from "clsx";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import Card from "@/components/Card";
import OrderDeleteModal from "@/components/orders/OrderDeleteModal";
import OrderToast from "@/components/orders/OrderToast";
import {
  deleteOrder,
  getDistinctOrderStatuses,
  getOrders,
} from "@/lib/orders";
import type { BotongOrder } from "@/types/orders";

function formatKrw(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoIso(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

const statusStyle: Record<string, string> = {
  발송대기: "bg-amber-50 text-amber-600",
  발송처리: "bg-blue-50 text-blue-600",
  배송중: "bg-indigo-50 text-indigo-600",
  배송완료: "bg-emerald-50 text-emerald-600",
  구매확정: "bg-emerald-50 text-emerald-600",
  취소: "bg-red-50 text-red-500",
};

export default function OrdersPageClient() {
  const [orders, setOrders] = useState<BotongOrder[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(monthAgoIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [orderStatus, setOrderStatus] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BotongOrder | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, statusList] = await Promise.all([
        getOrders({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          orderStatus: orderStatus || undefined,
          search: search || undefined,
        }),
        getDistinctOrderStatuses(),
      ]);
      setOrders(rows);
      setStatuses(statusList);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, orderStatus, search]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const totalSettlement = useMemo(
    () => orders.reduce((sum, o) => sum + o.settlement_amount, 0),
    [orders]
  );

  const handleDeleteConfirm = async (restoreStock: boolean) => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const result = await deleteOrder(deleteTarget.id, { restoreStock });
      if (!result.ok) {
        setToast({
          message: result.error ?? "주문 삭제에 실패했습니다.",
          type: "error",
        });
        return;
      }

      setOrders((prev) => prev.filter((o) => o.id !== deleteTarget.id));
      setDeleteTarget(null);
      setToast({ message: "주문이 삭제되었습니다.", type: "success" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Header title="주문 관리" subtitle="스마트스토어 주문 내역" />
      <div className="px-8 py-8">
        <PageHeader
          title="주문 목록"
          description="업로드된 스마트스토어 주문을 확인합니다"
          actions={
            <Link href="/orders/upload">
              <Button variant="primary" size="sm" icon={Upload}>
                주문 엑셀 업로드
              </Button>
            </Link>
          }
        />

        <Card className="mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                시작일
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#5b6af4] focus:ring-2 focus:ring-[#5b6af4]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                종료일
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#5b6af4] focus:ring-2 focus:ring-[#5b6af4]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                주문상태
              </label>
              <select
                value={orderStatus}
                onChange={(e) => setOrderStatus(e.target.value)}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#5b6af4] focus:ring-2 focus:ring-[#5b6af4]/20"
              >
                <option value="">전체</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-500">
                상품명 검색
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="상품명 입력"
                  className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#5b6af4] focus:ring-2 focus:ring-[#5b6af4]/20"
                />
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={loading ? Loader2 : RefreshCw}
              onClick={() => void loadOrders()}
              className={loading ? "[&_svg]:animate-spin" : ""}
            >
              새로고침
            </Button>
          </div>
        </Card>

        <Card padding="sm">
          <div className="mb-4 flex items-center justify-between px-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">주문 내역</h3>
              <p className="mt-0.5 text-xs text-gray-400">
                {orders.length}건 · 정산예정 합계 {formatKrw(totalSettlement)}원
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              불러오는 중...
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">
              주문 내역이 없습니다.{" "}
              <Link href="/orders/upload" className="text-[#5b6af4] hover:underline">
                엑셀 업로드
              </Link>
              로 주문을 등록하세요.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400">
                      주문일시
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400">
                      상품명
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400">
                      옵션
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-400">
                      수량
                    </th>
                    <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-400">
                      정산예정금액
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400">
                      주문상태
                    </th>
                    <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-400 w-16">
                      삭제
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-3 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(order.order_date)}
                      </td>
                      <td className="px-3 py-3.5 text-sm text-gray-700 max-w-[280px] truncate">
                        {order.product_name}
                      </td>
                      <td className="px-3 py-3.5 text-xs text-gray-500 max-w-[180px] truncate">
                        {order.option_name || "—"}
                      </td>
                      <td className="px-3 py-3.5 text-sm text-right text-gray-600">
                        {order.quantity}
                      </td>
                      <td className="px-3 py-3.5 text-sm text-right font-semibold text-gray-800 whitespace-nowrap">
                        {formatKrw(order.settlement_amount)}원
                      </td>
                      <td className="px-3 py-3.5">
                        <span
                          className={clsx(
                            "inline-flex text-xs font-medium px-2.5 py-1 rounded-lg",
                            statusStyle[order.order_status] ??
                              "bg-gray-50 text-gray-600"
                          )}
                        >
                          {order.order_status || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(order)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          aria-label={`${order.product_name} 주문 삭제`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {deleteTarget && (
        <OrderDeleteModal
          order={deleteTarget}
          deleting={deleting}
          onConfirm={(restoreStock) => void handleDeleteConfirm(restoreStock)}
          onCancel={() => {
            if (!deleting) setDeleteTarget(null);
          }}
        />
      )}

      {toast && (
        <OrderToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
