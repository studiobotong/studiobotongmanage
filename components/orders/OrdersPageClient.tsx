"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Upload, Search, Loader2, RefreshCw, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import Card from "@/components/Card";
import OrderDeleteModal from "@/components/orders/OrderDeleteModal";
import OrderBulkDeleteModal from "@/components/orders/OrderBulkDeleteModal";
import OrderToast from "@/components/orders/OrderToast";
import { getDistinctOrderStatuses, getOrders } from "@/lib/orders";
import type { BotongOrder, ConfirmationStatus } from "@/types/orders";

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

const PAGE_SIZE = 50;

function resetPage(setPage: (page: number) => void) {
  setPage(1);
}

const confirmationBadge: Record<
  ConfirmationStatus,
  { label: string; className: string }
> = {
  provisional: {
    label: "가입력",
    className: "bg-orange-50 text-orange-600 border border-orange-100",
  },
  confirmed: {
    label: "구매확정",
    className: "bg-blue-50 text-blue-600 border border-blue-100",
  },
};

export default function OrdersPageClient() {
  const pathname = usePathname();
  const [orders, setOrders] = useState<BotongOrder[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalSettlement, setTotalSettlement] = useState(0);
  const [page, setPage] = useState(1);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(monthAgoIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [orderStatus, setOrderStatus] = useState("");
  const [confirmationStatus, setConfirmationStatus] = useState<
    ConfirmationStatus | ""
  >("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<BotongOrder | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [result, statusList] = await Promise.all([
        getOrders({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          orderStatus: orderStatus || undefined,
          confirmationStatus: confirmationStatus || undefined,
          search: search || undefined,
          page,
          pageSize: PAGE_SIZE,
        }),
        getDistinctOrderStatuses(),
      ]);
      setOrders(result.orders);
      setTotalCount(result.totalCount);
      setTotalSettlement(result.totalSettlement);
      setStatuses(statusList);
      setSelectedIds(new Set());

      if (result.orders.length === 0 && page > 1 && result.totalCount > 0) {
        setPage(page - 1);
      }
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, orderStatus, confirmationStatus, search, page]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    return () => {
      setDeleteTarget(null);
      setBulkDeleteOpen(false);
    };
  }, []);

  useEffect(() => {
    if (pathname !== "/orders") {
      setDeleteTarget(null);
      setBulkDeleteOpen(false);
    }
  }, [pathname]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, totalCount);

  const allSelected =
    orders.length > 0 && orders.every((o) => selectedIds.has(o.id));
  const someSelected = selectedIds.size > 0;

  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedIds.has(o.id)),
    [orders, selectedIds]
  );

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeleteConfirm = async (restoreStock: boolean) => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/orders/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restoreStock }),
      });
      const result = (await res.json()) as {
        ok?: boolean;
        error?: string | null;
      };

      if (!res.ok || !result.ok) {
        setToast({
          message: result.error ?? "주문 삭제에 실패했습니다.",
          type: "error",
        });
        return;
      }

      setDeleteTarget(null);
      setToast({ message: "주문이 삭제되었습니다.", type: "success" });
      await loadOrders();
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDeleteConfirm = async (restoreStock: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/orders/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: ids, restoreStock }),
      });
      const result = (await res.json()) as {
        ok?: boolean;
        deleted?: number;
        restoredOrders?: number;
        error?: string | null;
      };

      if (!res.ok || !result.ok) {
        setToast({
          message: result.error ?? "일괄 삭제에 실패했습니다.",
          type: "error",
        });
        return;
      }

      const deleted = result.deleted ?? 0;
      const restored = result.restoredOrders ?? 0;
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);

      let message = `${deleted}건의 주문이 삭제되었습니다.`;
      if (restoreStock && restored > 0) {
        message += ` (${restored}건 재고 복구)`;
      }
      setToast({ message, type: "success" });
      await loadOrders();
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

        {someSelected && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-red-100 bg-red-50/60 px-4 py-3">
            <p className="text-sm text-red-700">
              <span className="font-semibold">{selectedIds.size}건</span> 선택됨
            </p>
            <Button
              variant="secondary"
              size="sm"
              icon={deleting ? Loader2 : Trash2}
              onClick={() => setBulkDeleteOpen(true)}
              disabled={deleting}
              className={clsx(
                "border-red-200 text-red-600 hover:bg-red-100",
                deleting && "[&_svg]:animate-spin"
              )}
            >
              선택 항목 삭제 ({selectedIds.size}건)
            </Button>
          </div>
        )}

        <Card className="mb-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                시작일
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  resetPage(setPage);
                }}
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
                onChange={(e) => {
                  setDateTo(e.target.value);
                  resetPage(setPage);
                }}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#5b6af4] focus:ring-2 focus:ring-[#5b6af4]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                확정 단계
              </label>
              <select
                value={confirmationStatus}
                onChange={(e) => {
                  setConfirmationStatus(
                    e.target.value as ConfirmationStatus | ""
                  );
                  resetPage(setPage);
                }}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#5b6af4] focus:ring-2 focus:ring-[#5b6af4]/20"
              >
                <option value="">전체</option>
                <option value="provisional">가입력</option>
                <option value="confirmed">구매확정</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">
                주문상태
              </label>
              <select
                value={orderStatus}
                onChange={(e) => {
                  setOrderStatus(e.target.value);
                  resetPage(setPage);
                }}
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
                  onChange={(e) => {
                    setSearch(e.target.value);
                    resetPage(setPage);
                  }}
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
                {totalCount}건 · 정산예정 합계 {formatKrw(totalSettlement)}원
                {totalCount > 0 && (
                  <span className="ml-1 text-gray-300">
                    ({pageStart}–{pageEnd}건 표시)
                  </span>
                )}
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
            <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label="전체 선택"
                        className="h-4 w-4 rounded border-gray-300 text-[#5b6af4] focus:ring-[#5b6af4]/20"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400">
                      주문일시
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400">
                      확정
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
                    <th className="w-16 px-3 py-2.5 text-center text-xs font-medium text-gray-400">
                      삭제
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const conf = confirmationBadge[order.confirmation_status];
                    return (
                      <tr
                        key={order.id}
                        className={clsx(
                          "border-b border-gray-50 transition-colors hover:bg-gray-50/60",
                          selectedIds.has(order.id) && "bg-[#eef0fe]/40"
                        )}
                      >
                        <td className="px-3 py-3.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(order.id)}
                            onChange={() => toggleSelect(order.id)}
                            aria-label={`${order.product_name} 선택`}
                            className="h-4 w-4 rounded border-gray-300 text-[#5b6af4] focus:ring-[#5b6af4]/20"
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-xs text-gray-500">
                          {formatDate(order.order_date)}
                        </td>
                        <td className="px-3 py-3.5">
                          <span
                            className={clsx(
                              "inline-flex text-xs font-medium px-2.5 py-1 rounded-lg",
                              conf.className
                            )}
                          >
                            {conf.label}
                          </span>
                        </td>
                        <td className="max-w-[240px] truncate px-3 py-3.5 text-sm text-gray-700">
                          {order.product_name}
                        </td>
                        <td className="max-w-[160px] truncate px-3 py-3.5 text-xs text-gray-500">
                          {order.option_name || "—"}
                        </td>
                        <td className="px-3 py-3.5 text-right text-sm text-gray-600">
                          {order.quantity}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-right text-sm font-semibold text-gray-800">
                          {formatKrw(order.settlement_amount)}원
                        </td>
                        <td className="px-3 py-3.5">
                          <span
                            className={clsx(
                              "inline-flex rounded-lg px-2.5 py-1 text-xs font-medium",
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-gray-50 px-2 pt-4">
                <p className="text-xs text-gray-400">
                  {page} / {totalPages} 페이지
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="이전 페이지"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - page) <= 2
                    )
                    .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                        acc.push("ellipsis");
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "ellipsis" ? (
                        <span
                          key={`ellipsis-${idx}`}
                          className="px-1 text-xs text-gray-300"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setPage(item)}
                          disabled={loading}
                          className={clsx(
                            "inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors",
                            item === page
                              ? "bg-[#5b6af4] text-white"
                              : "text-gray-600 hover:bg-gray-100"
                          )}
                        >
                          {item}
                        </button>
                      )
                    )}
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="다음 페이지"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            </>
          )}

          {someSelected && !loading && orders.length > 0 && (
            <div className="mt-4 flex justify-center border-t border-gray-50 pt-4">
              <Button
                variant="secondary"
                size="sm"
                icon={deleting ? Loader2 : Trash2}
                onClick={() => setBulkDeleteOpen(true)}
                disabled={deleting}
                className={clsx(
                  "border-red-200 text-red-600 hover:bg-red-100",
                  deleting && "[&_svg]:animate-spin"
                )}
              >
                선택 항목 삭제 ({selectedIds.size}건)
              </Button>
            </div>
          )}
        </Card>
      </div>

      {deleteTarget && (
        <OrderDeleteModal
          open={Boolean(deleteTarget)}
          order={deleteTarget}
          deleting={deleting}
          onConfirm={(restoreStock) => void handleDeleteConfirm(restoreStock)}
          onCancel={() => {
            if (!deleting) setDeleteTarget(null);
          }}
        />
      )}

      {bulkDeleteOpen && (
        <OrderBulkDeleteModal
          open={bulkDeleteOpen}
          selectedCount={selectedIds.size}
          productOrderNos={selectedOrders.map((o) => o.product_order_no)}
          deleting={deleting}
          onConfirm={(restoreStock) => void handleBulkDeleteConfirm(restoreStock)}
          onCancel={() => {
            if (!deleting) setBulkDeleteOpen(false);
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
