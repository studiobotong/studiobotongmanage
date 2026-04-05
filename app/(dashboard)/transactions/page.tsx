"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Upload,
  Search,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  ReceiptText,
  RefreshCw,
} from "lucide-react";
import clsx from "clsx";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import TransactionForm from "@/components/TransactionForm";
import { getTransactions, deleteTransaction } from "@/lib/transactions";
import type { AssetTransaction } from "@/types/transactions";

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold",
        type === "BUY"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-red-100 text-red-600"
      )}
    >
      {type === "BUY" ? "매수" : "매도"}
    </span>
  );
}

export default function TransactionsPage() {
  const router = useRouter();
  const [txs, setTxs] = useState<AssetTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editTx, setEditTx] = useState<AssetTransaction | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTransactions();
      setTxs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("이 거래를 삭제하시겠습니까?")) return;
    setDeletingId(id);
    try {
      await deleteTransaction(id);
      setTxs((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = txs.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Header title="Transactions" subtitle="거래원장" />
      <div className="px-6 py-8 space-y-6">
        <PageHeader
          title="거래원장"
          description="전체 매수·매도 내역을 관리합니다"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push("/transactions/upload")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all shadow-sm"
              >
                <Upload className="w-4 h-4" />
                엑셀 업로드
              </button>
              <button
                onClick={() => router.push("/transactions/new")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#5b6af4] hover:bg-[#4a58e8] transition-all shadow-sm shadow-indigo-200"
              >
                <Plus className="w-4 h-4" />
                신규 입력
              </button>
            </div>
          }
        />

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <input
                type="text"
                placeholder="종목명 또는 티커 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4] transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                {filtered.length.toLocaleString()}건
              </span>
              <button
                onClick={load}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
                title="새로고침"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 text-[#5b6af4] animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
              <p className="text-sm text-gray-600">{error}</p>
              <button
                onClick={load}
                className="text-sm text-[#5b6af4] hover:underline"
              >
                다시 시도
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center">
                <ReceiptText className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">
                {search ? "검색 결과 없음" : "거래 내역이 없습니다"}
              </p>
              {!search && (
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => router.push("/transactions/upload")}
                    className="text-sm text-[#5b6af4] hover:underline font-medium"
                  >
                    엑셀 업로드
                  </button>
                  <span className="text-gray-300">또는</span>
                  <button
                    onClick={() => router.push("/transactions/new")}
                    className="text-sm text-[#5b6af4] hover:underline font-medium"
                  >
                    직접 입력
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">거래일</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">유형</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">종목명</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">티커</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">시장</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">수량</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">단가</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">총액</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide">수수료</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">메모</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-gray-50/60 transition-colors group"
                    >
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-600 tabular-nums">
                        {new Date(tx.trade_date).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-3.5">
                        <TypeBadge type={tx.type} />
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-gray-800">
                        {tx.name}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                          {tx.symbol}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">
                          {tx.market}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-gray-700">
                        {tx.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-gray-700">
                        {tx.unit_price.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-gray-800">
                        {tx.total_amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-gray-500">
                        {tx.fee != null ? tx.fee.toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-3.5 text-gray-400 text-xs max-w-[120px] truncate">
                        {tx.memo || "-"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditTx(tx)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-[#eef0fe] hover:text-[#5b6af4] transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            disabled={deletingId === tx.id}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-50"
                          >
                            {deletingId === tx.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      {editTx && (
        <TransactionForm
          initial={editTx}
          isModal
          onSuccess={(updated) => {
            setTxs((prev) =>
              prev.map((t) => (t.id === updated.id ? updated : t))
            );
            setEditTx(null);
          }}
          onCancel={() => setEditTx(null)}
        />
      )}
    </>
  );
}
