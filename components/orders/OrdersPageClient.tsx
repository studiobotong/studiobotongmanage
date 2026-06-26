"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Loader2, Search, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import Header from "@/components/Header";
import Button from "@/components/Button";
import Card from "@/components/Card";
import OrderToast from "@/components/orders/OrderToast";
import { getBTMOrderList, getBTMDistinctStatuses, deleteBTMOrder } from "@/lib/btmOrders";
import type { BTMOrderRow } from "@/lib/btmOrders";

function formatKrw(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function todayIso(): string { return new Date().toISOString().slice(0, 10); }
function monthAgoIso(): string {
  const d = new Date(); d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PAYED:              { label: "결제완료",  color: "bg-blue-50 text-blue-600" },
  DELIVERING:         { label: "배송중",    color: "bg-indigo-50 text-indigo-600" },
  DELIVERED:          { label: "배송완료",  color: "bg-emerald-50 text-emerald-600" },
  PURCHASE_DECIDED:   { label: "구매확정",  color: "bg-green-50 text-green-600" },
  CANCEL_DONE:        { label: "취소완료",  color: "bg-red-50 text-red-500" },
  RETURN_DONE:        { label: "반품완료",  color: "bg-orange-50 text-orange-500" },
};

const STATUS_ORDER = ["PAYED", "DELIVERING", "DELIVERED", "PURCHASE_DECIDED", "CANCEL_DONE", "RETURN_DONE"];
const PAGE_SIZE = 50;

export default function OrdersPageClient() {
  const [orders, setOrders] = useState<BTMOrderRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPayment, setTotalPayment] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [dateFrom, setDateFrom] = useState(monthAgoIso());
  const [dateTo, setDateTo] = useState(todayIso());
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);
      const todayStr = todayIso();

      const [listResult, statusResult] = await Promise.all([
        getBTMOrderList({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          status: statusFilter || undefined,
          search: search || undefined,
          page,
          pageSize: PAGE_SIZE,
        }),
        // 상태 카운트는 항상 최근 7일 기준
        getBTMOrderList({
          dateFrom: sevenDaysAgoStr,
          dateTo: todayStr,
          pageSize: 1,
        }),
      ]);

      setOrders(listResult.orders);
      setTotalCount(listResult.totalCount);
      setTotalPayment(listResult.totalPayment);
      setStatusCounts(statusResult.statusCounts);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, statusFilter, search, page]);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const handleCollect = async () => {
    setCollecting(true);
    try {
      const res = await fetch("/api/cron/collect-orders", {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? "btm_cron_secret_2026"}` },
      });
      const json = await res.json();
      if (json.ok) {
        setToast({ message: `주문 ${json.result.upserted}건 수집 완료`, type: "success" });
        await loadOrders();
      } else {
        setToast({ message: json.error ?? "수집 실패", type: "error" });
      }
    } catch {
      setToast({ message: "수집 중 오류가 발생했습니다.", type: "error" });
    } finally {
      setCollecting(false);
    }
  };

  const handleDelete = async (order: BTMOrderRow) => {
    if (!confirm(`"${order.product_name}" 주문을 삭제하시겠습니까?`)) return;
    const result = await deleteBTMOrder(order.id);
    if (result.ok) {
      setToast({ message: "주문이 삭제되었습니다.", type: "success" });
      await loadOrders();
    } else {
      setToast({ message: result.error ?? "삭제 실패", type: "error" });
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <>
      <Header title="주문 관리" subtitle="스마트스토어 주문 내역" />
      <div className="flex justify-end px-4 sm:px-6 lg:px-8 pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            if (!confirm("2023-07-01부터 오늘까지 전체 주문을 재수집합니다. 시간이 걸릴 수 있습니다.")) return;
            setCollecting(true);
            try {
              const res = await fetch("/api/cron/collect-orders", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? "btm_cron_secret_2026"}`,
                  "Content-Type": "application/json",
                },
              });
              const json = await res.json();
              if (json.ok) {
                setToast({ message: `전체 ${json.result.totalUpserted}건 재수집 완료`, type: "success" });
                await loadOrders();
              } else {
                setToast({ message: json.error ?? "재수집 실패", type: "error" });
              }
            } catch {
              setToast({ message: "재수집 중 오류가 발생했습니다.", type: "error" });
            } finally {
              setCollecting(false);
            }
          }}
          disabled={collecting}
          icon={collecting ? Loader2 : RefreshCw}
          className={collecting ? "[&_svg]:animate-spin" : ""}
        >
          {collecting ? "재수집 중..." : "전체 재수집"}
        </Button>
      </div>
      <div className="px-4 sm:px-6 lg:px-8 py-6">

        {/* 상태별 카운트 카드 */}
        <div className="mb-1">
          <p className="text-xs text-gray-400">최근 7일 기준</p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
          {STATUS_ORDER.map((key) => {
            const info = STATUS_LABELS[key]!;
            const count = statusCounts[key] ?? 0;
            return (
              <button
                key={key}
                onClick={() => { setStatusFilter(statusFilter === key ? "" : key); setPage(1); }}
                className={clsx(
                  "rounded-2xl border px-3 py-3 text-center transition-all",
                  statusFilter === key
                    ? "border-[#5b6af4] bg-[#eef0fe]"
                    : "border-gray-100 bg-white hover:border-[#5b6af4]/40"
                )}
              >
                <p className="text-xs text-gray-500 mb-1">{info.label}</p>
                <p className="text-xl font-bold text-gray-800">{count.toLocaleString()}<span className="text-xs font-normal ml-0.5">건</span></p>
              </button>
            );
          })}
        </div>

        {/* 필터 + 수집 버튼 */}
        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <span className="text-gray-400 text-sm">~</span>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text" value={search} placeholder="상품명 검색"
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="rounded-xl border border-gray-200 pl-8 pr-4 py-2 text-sm w-48"
              />
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => loadOrders()} disabled={loading}>
                <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} />
                <span className="ml-1.5">새로고침</span>
              </Button>
              <Button variant="primary" size="sm" onClick={handleCollect} disabled={collecting}
                icon={collecting ? Loader2 : RefreshCw}
                className={collecting ? "[&_svg]:animate-spin" : ""}>
                {collecting ? "수집 중..." : "주문 수집"}
              </Button>
            </div>
          </div>
        </Card>

        {/* 주문 목록 */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">주문 내역</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {totalCount.toLocaleString()}건 · 정산예정 합계 {formatKrw(totalPayment)}원
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">불러오는 중…</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">주문 내역이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">주문일시</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">상품명</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">옵션</th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500">수량</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-gray-500">정산예정</th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-gray-500">상태</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">수취인</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const statusInfo = STATUS_LABELS[order.status ?? ""] ?? { label: order.status ?? "—", color: "bg-gray-50 text-gray-500" };
                    return (
                      <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(order.order_date)}</td>
                        <td className="px-3 py-3 text-gray-800 max-w-[200px]">
                          <p className="truncate text-xs font-medium">{order.product_name ?? "—"}</p>
                          <p className="text-[10px] text-gray-400 truncate">{order.order_id}</p>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500 max-w-[120px]">
                          <p className="truncate">{order.option_name ?? "—"}</p>
                          {order.option_code && <p className="text-[10px] text-gray-300 truncate">{order.option_code}</p>}
                        </td>
                        <td className="px-3 py-3 text-center text-xs text-gray-700">{order.quantity}</td>
                        <td className="px-3 py-3 text-right text-xs font-medium text-gray-800">{formatKrw(order.actual_payment)}원</td>
                        <td className="px-3 py-3 text-center">
                          <span className={clsx("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium", statusInfo.color)}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500">{order.receiver_name ?? order.buyer_name ?? "—"}</td>
                        <td className="px-3 py-3 text-right">
                          <button onClick={() => handleDelete(order)}
                            className="text-gray-300 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-100">
              <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-gray-500">{page} / {totalPages}</span>
              <Button variant="ghost" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </Card>
      </div>

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
