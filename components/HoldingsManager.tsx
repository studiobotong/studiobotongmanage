"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  AlertTriangle,
  PackageOpen,
  RefreshCw,
} from "lucide-react";
import clsx from "clsx";
import {
  getSnapshotHoldings,
  insertHolding,
  updateHolding,
  deleteHolding,
} from "@/lib/storage";
import {
  batchGetPrices,
  defaultUsdKrwRateState,
  type UsdKrwRateState,
} from "@/lib/priceService";
import { mergeQuotesIntoHoldings } from "@/lib/mergeQuotesIntoHoldings";
import {
  fetchMarketDataFromApi,
  refreshQuotesViaServer,
  syncOptionalBrowserCacheFromBundle,
} from "@/lib/marketDataClient";
import { groupRegularHoldings, type GroupedHolding } from "@/lib/holdingsGroup";
import {
  computeAllocationSignal,
  formatDiffLabel,
  formatTargetRange,
  hasValidTargetBand,
} from "@/lib/targetWeightBand";
import type { AssetSnapshotHolding } from "@/types/assets";

// ─────────────────────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────────────────────

const MARKETS     = ["KRX", "US", "CASH"] as const;
const CURRENCIES  = ["KRW", "USD"] as const;
const ACCOUNTS    = ["SAMSUNG", "MERITZ", "KIWOOM", "WIFE_KIWOOM"] as const;
const ASSET_TYPES = ["STOCK", "BOND", "KRW_CASH", "USD_CASH"] as const;
const NON_CASH_ASSET_TYPES = ["STOCK", "BOND"] as const;

const CURRENCY_SECTIONS = [
  {
    currency:    "KRW",
    label:       "원화 자산",
    headerClass: "border-l-2 border-blue-400",
    badgeClass:  "text-blue-600 bg-blue-50",
    totalLabel:  "원화 소계",
    formatTotal: (v: number) => `${v.toLocaleString("ko-KR")}원`,
  },
  {
    currency:    "USD",
    label:       "달러 자산",
    headerClass: "border-l-2 border-emerald-400",
    badgeClass:  "text-emerald-600 bg-emerald-50",
    totalLabel:  "달러 소계",
    formatTotal: (v: number) =>
      `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  },
] as const;

const ACCOUNT_LABELS: Record<(typeof ACCOUNTS)[number], string> = {
  SAMSUNG:     "삼성",
  MERITZ:      "메리츠",
  KIWOOM:      "키움",
  WIFE_KIWOOM: "와이프(키움)",
};

const ASSET_TYPE_LABELS: Record<(typeof ASSET_TYPES)[number], string> = {
  STOCK:    "주식",
  BOND:     "채권",
  KRW_CASH: "한화예수금",
  USD_CASH: "달러예수금",
};

const CASH_TYPES = new Set<string>(["KRW_CASH", "USD_CASH"]);

// ─────────────────────────────────────────────────────────────
// 계좌명 리스트 포맷 (최대 2개 표시, 초과 시 "외 N개")
// ─────────────────────────────────────────────────────────────

function formatAccountList(rows: AssetSnapshotHolding[]): { short: string; full: string } {
  const labels = rows
    .filter((r) => r.quantity > 0 && ACCOUNTS.includes(r.account as Account))
    .map((r) => ACCOUNT_LABELS[r.account as Account]);

  if (labels.length === 0) return { short: "-", full: "-" };
  const full = labels.join(", ");
  if (labels.length <= 2) return { short: full, full };
  return { short: `${labels.slice(0, 2).join(", ")} 외 ${labels.length - 2}개`, full };
}

// ─────────────────────────────────────────────────────────────
// 평가손익 포맷 (부호 포함)
// ─────────────────────────────────────────────────────────────

function fmtPnL(pnl: number, currency: string): string {
  const sign = pnl > 0 ? "+" : "";
  if (currency === "USD") {
    return `${sign}$${Math.abs(pnl).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  const absStr = Math.round(Math.abs(pnl)).toLocaleString("ko-KR");
  return `${sign.length > 0 ? sign : pnl < 0 ? "-" : ""}${absStr}원`;
}

const CASH_META: Record<string, { currency: "KRW" | "USD"; name: string; symbol: string }> = {
  KRW_CASH: { currency: "KRW", name: "한화예수금", symbol: "KRW" },
  USD_CASH: { currency: "USD", name: "달러예수금", symbol: "USD" },
};

type Market           = (typeof MARKETS)[number];
type Currency         = (typeof CURRENCIES)[number];
type Account          = (typeof ACCOUNTS)[number];
type AssetType        = (typeof ASSET_TYPES)[number];
type CashAssetType    = "KRW_CASH" | "USD_CASH";
type NonCashAssetType = (typeof NON_CASH_ASSET_TYPES)[number];

// ─────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function safeNum(v: string): number {
  const n = parseFloat(v.replace(/,/g, ""));
  return isNaN(n) || n < 0 ? 0 : n;
}

/** 목표 비중 저장 직전: Number 변환, 빈값은 null, 유효하지 않으면 null */
function parseTargetWeightNumberOrNull(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t.replace(/,/g, ""));
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

function fmtAmount(v: number, currency: string): string {
  if (currency === "USD") {
    return `$${v.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `${v.toLocaleString("ko-KR")}원`;
}

const MARKET_BADGE: Record<string, string> = {
  KRX:  "bg-blue-50 text-blue-600 border-blue-100",
  US:   "bg-emerald-50 text-emerald-600 border-emerald-100",
  CASH: "bg-amber-50 text-amber-600 border-amber-100",
};

// ─────────────────────────────────────────────────────────────
// 예수금 자동 생성 — 4계좌 × 2유형 = 최대 8행
// ─────────────────────────────────────────────────────────────

async function ensureCashHoldings(
  holdings: AssetSnapshotHolding[],
  snapshotDate: string
): Promise<boolean> {
  const existingKeys = new Set(
    holdings.map((h) => `${h.account}|${h.asset_type}|${h.snapshot_date}`)
  );

  let inserted = false;
  for (const [assetType, meta] of Object.entries(CASH_META)) {
    for (const account of ACCOUNTS) {
      const key = `${account}|${assetType}|${snapshotDate}`;
      if (!existingKeys.has(key)) {
        await insertHolding({
          snapshot_date:    snapshotDate,
          name:             meta.name,
          symbol:           meta.symbol,
          market:           "CASH",
          currency:         meta.currency,
          account,
          quantity:         1,
          avg_price:        0,
          current_price:    0,
          evaluated_amount: 0,
          asset_type:       assetType,
        });
        inserted = true;
      }
    }
  }
  return inserted;
}

// ─────────────────────────────────────────────────────────────
// 예수금 전용 수정 팝업
// ─────────────────────────────────────────────────────────────

type AccountBalances = Record<Account, string>;

interface CashEditModalProps {
  open:         boolean;
  assetType:    CashAssetType | null;
  existingRows: AssetSnapshotHolding[];
  snapshotDate: string;
  onClose:      () => void;
  onSaved:      () => void;
}

function CashEditModal({
  open,
  assetType,
  existingRows,
  snapshotDate,
  onClose,
  onSaved,
}: CashEditModalProps) {
  const [balances, setBalances] = useState<AccountBalances>({
    SAMSUNG: "", MERITZ: "", KIWOOM: "", WIFE_KIWOOM: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!open || !assetType) return;

    const init: AccountBalances = { SAMSUNG: "", MERITZ: "", KIWOOM: "", WIFE_KIWOOM: "" };
    const byAccount = new Map<string, AssetSnapshotHolding[]>();
    existingRows.forEach((r) => {
      const acc = r.account ?? "";
      if (!byAccount.has(acc)) byAccount.set(acc, []);
      byAccount.get(acc)!.push(r);
    });
    const perAccountMax = new Map<Account, number>();
    for (const r of existingRows) {
      if (!ACCOUNTS.includes(r.account as Account)) continue;
      const acc = r.account as Account;
      perAccountMax.set(acc, Math.max(perAccountMax.get(acc) ?? 0, r.evaluated_amount));
    }
    for (const acc of ACCOUNTS) {
      const v = perAccountMax.get(acc) ?? 0;
      init[acc] = v > 0 ? String(v) : "";
    }

    if (process.env.NODE_ENV === "development") {
      console.debug("[CashEditModal] 초기화", {
        assetType,
        snapshotDate,
        duplicateAccounts: [...byAccount.entries()]
          .filter(([, list]) => list.length > 1)
          .map(([acc]) => acc),
        rows: existingRows.map((r) => ({
          id: r.id,
          account: r.account,
          evaluated_amount: r.evaluated_amount,
        })),
        initBalances: init,
      });
    }

    setBalances(init);
    setError(null);
  }, [open, assetType, existingRows, snapshotDate]);

  if (!open || !assetType) return null;

  const meta     = CASH_META[assetType];
  const currency = meta.currency;
  const total    = ACCOUNTS.reduce(
    (s, acc) => s + (parseFloat(balances[acc].replace(/,/g, "")) || 0),
    0
  );

  async function handleSave() {
    setSaving(true);
    setError(null);
    const payload = ACCOUNTS.map((account) => ({
      account,
      amount: parseFloat(balances[account].replace(/,/g, "")) || 0,
    }));
    if (process.env.NODE_ENV === "development") {
      console.debug("[CashEditModal] 저장 직전 payload", {
        assetType,
        snapshotDate,
        payload,
        existingRowIds: existingRows.map((r) => r.id),
      });
    }
    try {
      for (const account of ACCOUNTS) {
        const amount = parseFloat(balances[account].replace(/,/g, "")) || 0;
        const matches = existingRows
          .filter((r) => r.account === account)
          .sort(
            (a, b) =>
              b.evaluated_amount - a.evaluated_amount ||
              String(b.id).localeCompare(String(a.id))
          );
        if (matches.length > 0) {
          const [keep, ...dupes] = matches;
          await updateHolding(keep.id, {
            evaluated_amount: amount,
            avg_price:        amount,
            current_price:    amount,
          });
          for (const d of dupes) {
            await deleteHolding(d.id);
          }
        } else {
          await insertHolding({
            snapshot_date:    snapshotDate,
            name:             meta.name,
            symbol:           meta.symbol,
            market:           "CASH",
            currency,
            account,
            quantity:         1,
            avg_price:        amount,
            current_price:    amount,
            evaluated_amount: amount,
            asset_type:       assetType ?? undefined,
          });
        }
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">{meta.name} 수정</h3>
            <p className="text-xs text-gray-400 mt-0.5">계좌별 잔고를 입력하세요</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {ACCOUNTS.map((acc) => (
            <div key={acc}>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                {ACCOUNT_LABELS[acc]}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none select-none">
                  {currency === "USD" ? "$" : "₩"}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={balances[acc]}
                  onChange={(e) =>
                    setBalances((prev) => ({ ...prev, [acc]: e.target.value }))
                  }
                  className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                />
              </div>
            </div>
          ))}

          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between mt-1">
            <span className="text-xs font-semibold text-gray-400">합계</span>
            <span className="text-sm font-bold text-gray-800 tabular-nums">
              {fmtAmount(total, currency)}
            </span>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#5b6af4] hover:bg-[#4f5fe0] disabled:opacity-60 transition-all shadow-sm shadow-indigo-200"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 채권 관리 팝업
// ─────────────────────────────────────────────────────────────

interface BondDraft {
  id?:          string;
  name:         string;
  maturityDate: string;   // symbol 필드에 저장
  account:      string;
  amount:       string;
}

interface BondEditModalProps {
  open:         boolean;
  currency:     "KRW" | "USD" | null;
  existingRows: AssetSnapshotHolding[];
  snapshotDate: string;
  onClose:      () => void;
  onSaved:      () => void;
}

function BondEditModal({
  open,
  currency,
  existingRows,
  snapshotDate,
  onClose,
  onSaved,
}: BondEditModalProps) {
  const [drafts, setDrafts] = useState<BondDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!open || !currency) return;
    setDrafts(
      existingRows.map((r) => ({
        id:           r.id,
        name:         r.name,
        maturityDate: r.symbol ?? "",
        account:      r.account ?? "",
        amount:       r.evaluated_amount > 0 ? String(r.evaluated_amount) : "",
      }))
    );
    setError(null);
  }, [open, currency, existingRows]);

  if (!open || !currency) return null;

  const label = currency === "KRW" ? "원화채권" : "달러채권";

  function updateDraft(idx: number, field: keyof BondDraft, value: string) {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d)));
  }

  function addRow() {
    setDrafts((prev) => [...prev, { name: "", maturityDate: "", account: "", amount: "" }]);
  }

  function removeRow(idx: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== idx));
  }

  const total = drafts.reduce(
    (s, d) => s + (parseFloat(d.amount.replace(/,/g, "")) || 0),
    0
  );

  async function handleSave() {
    for (const d of drafts) {
      if (!d.name.trim() && d.amount !== "" && parseFloat(d.amount) > 0) {
        setError("채권명을 입력해주세요.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const existingIds = new Set(existingRows.map((r) => r.id));
      const keptIds     = new Set(drafts.filter((d) => d.id).map((d) => d.id!));

      // 삭제된 행 처리
      for (const row of existingRows) {
        if (!keptIds.has(row.id)) {
          await deleteHolding(row.id);
        }
      }

      // 업데이트 또는 신규 삽입
      for (const d of drafts) {
        if (!d.name.trim()) continue;

        const amount = parseFloat(d.amount.replace(/,/g, "")) || 0;
        const payload = {
          name:             d.name.trim(),
          symbol:           d.maturityDate || undefined,
          account:          d.account || undefined,
          currency:         currency ?? undefined,
          evaluated_amount: amount,
          avg_price:        amount,
          current_price:    amount,
          quantity:         1,
          asset_type:       "BOND",
          market:           "CASH",
        };

        if (d.id && existingIds.has(d.id)) {
          await updateHolding(d.id, payload);
        } else {
          await insertHolding({ snapshot_date: snapshotDate, ...payload });
        }
      }

      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-gray-900">{label} 관리</h3>
            <p className="text-xs text-gray-400 mt-0.5">보유 채권을 추가·수정·삭제하세요</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 바디 */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-3">
            {drafts.length === 0 && (
              <div className="text-center py-8 text-sm text-gray-400">
                보유 채권이 없습니다. 아래 버튼으로 추가해주세요.
              </div>
            )}
            {drafts.map((d, idx) => (
              <div
                key={idx}
                className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">채권 {idx + 1}</span>
                  <button
                    onClick={() => removeRow(idx)}
                    className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">
                      채권명 <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="예) 미국채 10년물"
                      value={d.name}
                      onChange={(e) => updateDraft(idx, "name", e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">만기일</label>
                    <input
                      type="date"
                      value={d.maturityDate}
                      onChange={(e) => updateDraft(idx, "maturityDate", e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">계좌</label>
                    <select
                      value={d.account}
                      onChange={(e) => updateDraft(idx, "account", e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                    >
                      <option value="">선택 안 함</option>
                      {ACCOUNTS.map((acc) => (
                        <option key={acc} value={acc}>{ACCOUNT_LABELS[acc]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">
                      보유금액 <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                        {currency === "USD" ? "$" : "₩"}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={d.amount}
                        onChange={(e) => updateDraft(idx, "amount", e.target.value)}
                        className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={addRow}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#5b6af4] border border-[#5b6af4]/20 bg-indigo-50/50 hover:bg-indigo-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            채권 추가
          </button>

          {drafts.length > 0 && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-400">합계</span>
              <span className="text-sm font-bold text-gray-800 tabular-nums">
                {fmtAmount(total, currency)}
              </span>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#5b6af4] hover:bg-[#4f5fe0] disabled:opacity-60 transition-all shadow-sm shadow-indigo-200"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 계좌별 수량/평균단가 입력 구조
// ─────────────────────────────────────────────────────────────

interface AccountEntry {
  quantity:  string;
  avg_price: string;
}
type AccountEntries = Record<Account, AccountEntry>;

function emptyAccountEntries(): AccountEntries {
  return {
    SAMSUNG:     { quantity: "", avg_price: "" },
    MERITZ:      { quantity: "", avg_price: "" },
    KIWOOM:      { quantity: "", avg_price: "" },
    WIFE_KIWOOM: { quantity: "", avg_price: "" },
  };
}

// ─────────────────────────────────────────────────────────────
// 일반 종목 추가 팝업 (종목 공통 + 계좌별 입력)
// ─────────────────────────────────────────────────────────────

interface AddHoldingModalProps {
  open:         boolean;
  snapshotDate: string;
  onClose:      () => void;
  onSaved:      () => void;
}

function AddHoldingModal({ open, snapshotDate, onClose, onSaved }: AddHoldingModalProps) {
  const [date, setDate]           = useState(snapshotDate);
  const [name, setName]           = useState("");
  const [symbol, setSymbol]       = useState("");
  const [market, setMarket]       = useState<Market>("KRX");
  const [currency, setCurrency]   = useState<Currency>("KRW");
  const [assetType, setAssetType] = useState<NonCashAssetType>("STOCK");
  const [accounts, setAccounts]   = useState<AccountEntries>(emptyAccountEntries());
  const [manualPriceEnabled, setManualPriceEnabled] = useState(false);
  const [manualPrice, setManualPrice]               = useState("");
  const [targetMinStr, setTargetMinStr]             = useState("");
  const [targetMaxStr, setTargetMaxStr]           = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDate(snapshotDate);
      setName("");
      setSymbol("");
      setMarket("KRX");
      setCurrency("KRW");
      setAssetType("STOCK");
      setAccounts(emptyAccountEntries());
      setManualPriceEnabled(false);
      setManualPrice("");
      setTargetMinStr("");
      setTargetMaxStr("");
      setError(null);
    }
  }, [open, snapshotDate]);

  if (!open) return null;

  function setAccountField(acc: Account, field: keyof AccountEntry, value: string) {
    setAccounts((prev) => ({ ...prev, [acc]: { ...prev[acc], [field]: value } }));
  }

  const totalQty  = ACCOUNTS.reduce((s, acc) => s + safeNum(accounts[acc].quantity), 0);
  const totalCost = ACCOUNTS.reduce((s, acc) => {
    return s + safeNum(accounts[acc].quantity) * safeNum(accounts[acc].avg_price);
  }, 0);

  async function handleSave() {
    if (!date)         { setError("기준일을 입력해주세요."); return; }
    if (!name.trim())  { setError("종목명을 입력해주세요."); return; }
    if (!symbol.trim()) { setError("티커를 입력해주세요."); return; }

    const validAccounts = ACCOUNTS.filter((acc) => safeNum(accounts[acc].quantity) > 0);
    if (validAccounts.length === 0) {
      setError("최소 1개 계좌의 보유수량을 입력해주세요.");
      return;
    }

    let stockTargets: { target_min_weight: number | null; target_max_weight: number | null } = {
      target_min_weight: null,
      target_max_weight: null,
    };
    if (assetType === "STOCK") {
      const minE = targetMinStr.trim() === "";
      const maxE = targetMaxStr.trim() === "";
      if (minE !== maxE) {
        setError("최소·최대 비중을 모두 입력하거나 둘 다 비우세요.");
        return;
      }
      if (!minE && !maxE) {
        const tMin = parseTargetWeightNumberOrNull(targetMinStr);
        const tMax = parseTargetWeightNumberOrNull(targetMaxStr);
        if (tMin === null || tMax === null) {
          setError("목표 비중은 0 이상의 숫자로 입력해주세요.");
          return;
        }
        if (tMin > tMax) {
          setError("최소 비중은 최대 비중보다 클 수 없습니다.");
          return;
        }
        stockTargets = { target_min_weight: tMin, target_max_weight: tMax };
      }
    }

    setError(null);
    setSaving(true);
    try {
      let currentPrice = 0;
      if (manualPriceEnabled) {
        currentPrice = safeNum(manualPrice);
      } else {
        try {
          const priceMap = await batchGetPrices([{ symbol: symbol.trim(), currency, market }]);
          currentPrice = priceMap[symbol.trim()] ?? 0;
        } catch (e) {
          console.error("[AddHoldingModal] 시세 조회 실패:", e);
        }
      }

      for (const acc of validAccounts) {
        const qty = safeNum(accounts[acc].quantity);
        const avg = safeNum(accounts[acc].avg_price);
        // 조회 실패 시 avg_price로 대체하지 않음 — 실제 시세가 없으면 0으로 저장
        const cur = currentPrice > 0 ? currentPrice : 0;
        await insertHolding({
          snapshot_date:    date,
          name:             name.trim(),
          symbol:           symbol.trim(),
          market,
          currency,
          account:          acc,
          quantity:         qty,
          avg_price:        avg,
          current_price:    cur,
          evaluated_amount: qty * cur,
          asset_type:       assetType,
          ...stockTargets,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-gray-900">종목 추가</h3>
            <p className="text-xs text-gray-400 mt-0.5">종목 정보와 계좌별 보유수량을 입력하세요</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* ── 종목 공통 정보 ── */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              종목 공통 정보
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">기준일</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  종목명 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="예) 삼성생명"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  티커 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="예) 032830"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">시장</label>
                <select
                  value={market}
                  onChange={(e) => setMarket(e.target.value as Market)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                >
                  {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">통화</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as Currency)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">자산유형</label>
                <select
                  value={assetType}
                  onChange={(e) => setAssetType(e.target.value as NonCashAssetType)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                >
                  {NON_CASH_ASSET_TYPES.map((t) => (
                    <option key={t} value={t}>{ASSET_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 현재가 */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  checked={manualPriceEnabled}
                  onChange={(e) => setManualPriceEnabled(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#5b6af4] cursor-pointer"
                />
                <span className="text-xs font-semibold text-gray-600">수동 현재가 입력</span>
                <span className="text-[10px] text-gray-400">(조회 불가 종목)</span>
              </label>

              {manualPriceEnabled ? (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                    {currency === "USD" ? "$" : "₩"}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="현재가 직접 입력"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    className="w-full border border-[#5b6af4]/50 rounded-xl pl-7 pr-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4] bg-indigo-50/30"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                  <span className="text-xs text-gray-400">
                    저장 후 보유현황 페이지에서 "현재가 갱신" 버튼으로 시세를 업데이트하세요.
                  </span>
                </div>
              )}
            </div>

            {assetType === "STOCK" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    최소 비중 (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="예) 20"
                    value={targetMinStr}
                    onChange={(e) => setTargetMinStr(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    최대 비중 (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="예) 30"
                    value={targetMaxStr}
                    onChange={(e) => setTargetMaxStr(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── 계좌별 보유 수량 ── */}
          <div className="space-y-3">
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                계좌별 보유 수량
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                입력값이 없는 계좌는 저장되지 않습니다.
              </p>
            </div>

            <div className="space-y-2">
              {ACCOUNTS.map((acc) => (
                <div
                  key={acc}
                  className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3"
                >
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    {ACCOUNT_LABELS[acc]}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">보유수량</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={accounts[acc].quantity}
                        onChange={(e) => setAccountField(acc, "quantity", e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">평균단가</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={accounts[acc].avg_price}
                        onChange={(e) => setAccountField(acc, "avg_price", e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {totalQty > 0 && (
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-600">총 수량</span>
                <span className="text-sm font-bold text-indigo-700 tabular-nums">
                  {totalQty.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}주
                  &nbsp;/&nbsp;매입금액 {fmtAmount(totalCost, currency)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#5b6af4] hover:bg-[#4f5fe0] disabled:opacity-60 transition-all shadow-sm shadow-indigo-200"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            종목 추가
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 일반 종목 수정 팝업 (계좌별 수정)
// ─────────────────────────────────────────────────────────────

interface EditGroupedHoldingModalProps {
  open:         boolean;
  group:        GroupedHolding | null;
  snapshotDate: string;
  onClose:      () => void;
  onSaved:      () => void;
}

function EditGroupedHoldingModal({
  open,
  group,
  snapshotDate,
  onClose,
  onSaved,
}: EditGroupedHoldingModalProps) {
  const [accounts, setAccounts] = useState<AccountEntries>(emptyAccountEntries());
  const [targetMinStr, setTargetMinStr] = useState("");
  const [targetMaxStr, setTargetMaxStr] = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!open || !group) return;
    const init = emptyAccountEntries();
    group.rows.forEach((r) => {
      if (r.account && ACCOUNTS.includes(r.account as Account)) {
        init[r.account as Account] = {
          quantity:  r.quantity > 0  ? String(r.quantity)  : "",
          avg_price: r.avg_price > 0 ? String(r.avg_price) : "",
        };
      }
    });
    const ref = group.rows[0];
    const tm  = ref?.target_min_weight;
    const tx  = ref?.target_max_weight;
    const minStr = tm != null && Number.isFinite(tm) ? String(tm) : "";
    const maxStr = tx != null && Number.isFinite(tx) ? String(tx) : "";
    setTargetMinStr(minStr);
    setTargetMaxStr(maxStr);
    setAccounts(init);
    setError(null);
    console.log("[EditGroupedHolding] 모달 열림 — DB → 화면 바인딩", {
      종목명: group.name,
      symbol: group.symbol,
      "DB.target_min_weight": tm,
      "DB.target_max_weight": tx,
      "화면.targetMinStr": minStr,
      "화면.targetMaxStr": maxStr,
    });
  }, [open, group]);

  if (!open || !group) return null;

  function setAccountField(acc: Account, field: keyof AccountEntry, value: string) {
    setAccounts((prev) => ({ ...prev, [acc]: { ...prev[acc], [field]: value } }));
  }

  const totalQty = ACCOUNTS.reduce((s, acc) => s + safeNum(accounts[acc].quantity), 0);

  async function handleSave() {
    setError(null);

    let target_min_weight: number | null = null;
    let target_max_weight: number | null = null;
    if (group!.asset_type === "STOCK") {
      const minE = targetMinStr.trim() === "";
      const maxE = targetMaxStr.trim() === "";
      if (minE !== maxE) {
        setError("최소·최대 비중을 모두 입력하거나 둘 다 비우세요.");
        return;
      }
      if (!minE && !maxE) {
        const tMin = parseTargetWeightNumberOrNull(targetMinStr);
        const tMax = parseTargetWeightNumberOrNull(targetMaxStr);
        if (tMin === null || tMax === null) {
          setError("목표 비중은 0 이상의 숫자로 입력해주세요.");
          return;
        }
        if (tMin > tMax) {
          setError("최소 비중은 최대 비중보다 클 수 없습니다.");
          return;
        }
        target_min_weight = tMin;
        target_max_weight = tMax;
      }
    }

    const targetPayload = { target_min_weight, target_max_weight };

    setSaving(true);
    let updateOrInsertRowCount = 0;
    try {
      for (const acc of ACCOUNTS) {
        const qty      = safeNum(accounts[acc].quantity);
        const avg      = safeNum(accounts[acc].avg_price);
        const existing = group!.rows.find((r) => r.account === acc);

        if (qty > 0) {
          const cur     = group!.currentPrice > 0 ? group!.currentPrice : avg;
          const payload = {
            quantity:         qty,
            avg_price:        avg,
            current_price:    cur,
            evaluated_amount: qty * cur,
            ...targetPayload,
          };

          console.log("[EditGroupedHolding] 저장 시도", {
            종목명: group!.name,
            symbol: group!.symbol,
            account: acc,
            payload,
            target_min_weight: targetPayload.target_min_weight,
            target_max_weight: targetPayload.target_max_weight,
          });

          if (existing) {
            const holding = await updateHolding(existing.id, payload);
            updateOrInsertRowCount += 1;
            console.log("[EditGroupedHolding] Supabase update 결과", {
              id: existing.id,
              holding,
              target_min_weight: holding?.target_min_weight,
              target_max_weight: holding?.target_max_weight,
            });
          } else {
            const inserted = await insertHolding({
              snapshot_date:    snapshotDate,
              name:             group!.name,
              symbol:           group!.symbol,
              market:           group!.market,
              currency:         group!.currency,
              account:          acc,
              asset_type:       group!.asset_type,
              ...payload,
            });
            updateOrInsertRowCount += 1;
            console.log("[EditGroupedHolding] Supabase insert 결과", {
              id: inserted.id,
              target_min_weight: inserted.target_min_weight,
              target_max_weight: inserted.target_max_weight,
            });
          }
        } else if (existing) {
          // 수량 비워두면 해당 계좌 row 삭제
          await deleteHolding(existing.id);
        }
      }

      console.log("[EditGroupedHolding] 저장 요약", {
        종목명: group!.name,
        symbol: group!.symbol,
        target_min_weight: targetPayload.target_min_weight,
        target_max_weight: targetPayload.target_max_weight,
        update대상_row_개수: updateOrInsertRowCount,
      });

      const fresh = await getSnapshotHoldings();
      const sameGroup = fresh.filter(
        (h) =>
          h.snapshot_date === snapshotDate &&
          (h.symbol ?? "") === (group!.symbol ?? "") &&
          (h.market ?? "") === (group!.market ?? "") &&
          (h.currency ?? "") === (group!.currency ?? "") &&
          (h.asset_type ?? "") === (group!.asset_type ?? "")
      );
      console.log("[EditGroupedHolding] 저장 후 DB 재조회", {
        rows: sameGroup.map((r) => ({
          id: r.id,
          account: r.account,
          target_min_weight: r.target_min_weight,
          target_max_weight: r.target_max_weight,
        })),
      });

      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-bold text-gray-900">{group.name} 수정</h3>
            <p className="text-xs text-gray-400 mt-0.5">계좌별 보유 내역을 수정하세요</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          <p className="text-[11px] text-gray-400">
            수량을 비우면 해당 계좌 row가 삭제됩니다.
          </p>

          {ACCOUNTS.map((acc) => (
            <div key={acc} className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">
                {ACCOUNT_LABELS[acc]}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">보유수량</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={accounts[acc].quantity}
                    onChange={(e) => setAccountField(acc, "quantity", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">평균단가</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={accounts[acc].avg_price}
                    onChange={(e) => setAccountField(acc, "avg_price", e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                  />
                </div>
              </div>
            </div>
          ))}

          {group.asset_type === "STOCK" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  최소 비중 (%)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="예) 20"
                  value={targetMinStr}
                  onChange={(e) => setTargetMinStr(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  최대 비중 (%)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="예) 30"
                  value={targetMaxStr}
                  onChange={(e) => setTargetMaxStr(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
                />
              </div>
            </div>
          )}

          <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">총 수량</span>
            <span className="text-sm font-bold text-gray-800 tabular-nums">
              {totalQty.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}주
            </span>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#5b6af4] hover:bg-[#4f5fe0] disabled:opacity-60 transition-all shadow-sm shadow-indigo-200"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            수정 저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────

function fmtDateTime(d: Date): string {
  return d.toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

/** 평가금액을 원화로 환산 (통합 비중 분모·분자 공통) */
function evalAmountToKrw(evaluatedAmount: number, currency: string | undefined, usdKrwRate: number): number {
  return currency === "USD" ? evaluatedAmount * usdKrwRate : evaluatedAmount;
}

export default function HoldingsManager() {
  const [holdings, setHoldings]           = useState<AssetSnapshotHolding[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen]   = useState(false);
  const [editGroup, setEditGroup]         = useState<GroupedHolding | null>(null);
  const [deleteGroup, setDeleteGroup]     = useState<GroupedHolding | null>(null);
  const [deleting, setDeleting]           = useState(false);
  const [cashModalType, setCashModalType]         = useState<CashAssetType | null>(null);
  const [bondModalCurrency, setBondModalCurrency] = useState<"KRW" | "USD" | null>(null);
  const [priceRefreshing, setPriceRefreshing]     = useState(false);
  const [refreshFailedSymbols, setRefreshFailedSymbols] = useState<Set<string>>(new Set());
  const [usdKrw, setUsdKrw] = useState<UsdKrwRateState>(() => defaultUsdKrwRateState());

  /** 마지막 시세 갱신 시각 — DB `market_data_cache` 기준과 동기 */
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const persistLastRefreshedAt = (d: Date) => {
    setLastRefreshedAt(d);
  };

  const [symbolRefreshedAt, setSymbolRefreshedAt] = useState<Map<string, Date>>(() => new Map());

  const persistSymbolRefreshedAt = (m: Map<string, Date>) => {
    setSymbolRefreshedAt(m);
  };

  const snapshotDate = holdings.length > 0 ? holdings[0].snapshot_date : todayStr();

  // ── 조회 + 예수금 자동 생성 ──────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getSnapshotHoldings();

      let latestDate = todayStr();
      if (all.length > 0) {
        latestDate = [...all].sort((a, b) =>
          b.snapshot_date.localeCompare(a.snapshot_date)
        )[0].snapshot_date;
      }

      const latest = all.filter((h) => h.snapshot_date === latestDate);
      const inserted = await ensureCashHoldings(latest, latestDate);

      let rowsForDate: typeof latest;
      if (inserted) {
        const refreshed = await getSnapshotHoldings();
        rowsForDate = refreshed.filter((h) => h.snapshot_date === latestDate);
      } else {
        rowsForDate = latest;
      }

      const bundle = await fetchMarketDataFromApi();
      if (bundle) {
        setUsdKrw(bundle.usdKrw);
        syncOptionalBrowserCacheFromBundle(bundle);
        if (bundle.lastQuoteRefreshAt) {
          setLastRefreshedAt(bundle.lastQuoteRefreshAt);
        }
        if (bundle.quotesMeta) {
          const m = new Map<string, Date>();
          for (const [sym, meta] of Object.entries(bundle.quotesMeta)) {
            if (meta.updatedAt) m.set(sym, meta.updatedAt);
          }
          setSymbolRefreshedAt(m);
        }
      }
      const merged = mergeQuotesIntoHoldings(rowsForDate, bundle?.quotes ?? {});
      if (process.env.NODE_ENV === "development") {
        const cash = merged.filter((h) => CASH_TYPES.has(h.asset_type ?? ""));
        console.debug("[HoldingsManager] load 후 불러온 예수금", {
          snapshotDate: latestDate,
          rows: cash.map((r) => ({
            id: r.id,
            account: r.account,
            asset_type: r.asset_type,
            evaluated_amount: r.evaluated_amount,
          })),
        });
      }
      setHoldings(merged);
    } catch (e) {
      setError(e instanceof Error ? e.message : "데이터 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── 수동 현재가 갱신 (STOCK 전용, 버튼 클릭 시에만 실행) ────────────────

  async function handlePriceRefresh() {
    if (priceRefreshing || holdings.length === 0) return;
    setPriceRefreshing(true);
    setRefreshFailedSymbols(new Set());
    try {
      // 예수금(KRW_CASH, USD_CASH) 및 채권(BOND) 제외 — STOCK만 조회
      const stockHoldings = holdings.filter((h) => h.asset_type === "STOCK");
      if (stockHoldings.length === 0) {
        persistLastRefreshedAt(new Date());
        return;
      }

      const beforePriceBySym = new Map<string, number>();
      for (const h of stockHoldings) {
        if (!h.symbol) continue;
        const p = Number(h.current_price);
        beforePriceBySym.set(h.symbol, Number.isFinite(p) ? p : 0);
      }

      const refreshRes = await refreshQuotesViaServer(true);
      if (!refreshRes.ok) {
        console.error("[Holdings] 시세 갱신 실패:", refreshRes.error);
        setRefreshFailedSymbols(
          new Set(stockHoldings.filter((h) => h.symbol).map((h) => h.symbol!))
        );
        await load();
        return;
      }

      const priceMap = refreshRes.quotes;
      const now = new Date();
      const failed = new Set<string>();
      const newSymbolTimes = new Map<string, Date>();

      const uniqueSymbols = [
        ...new Set(stockHoldings.filter((h) => h.symbol).map((h) => h.symbol!)),
      ];

      const freshRows = await getSnapshotHoldings();
      let latestDate = snapshotDate;
      if (freshRows.length > 0) {
        latestDate = [...freshRows].sort((a, b) =>
          b.snapshot_date.localeCompare(a.snapshot_date)
        )[0].snapshot_date;
      }
      const afterPriceBySym = new Map<string, number>();
      for (const h of freshRows) {
        if (
          h.snapshot_date !== latestDate ||
          h.asset_type !== "STOCK" ||
          !h.symbol
        ) {
          continue;
        }
        const p = Number(h.current_price);
        afterPriceBySym.set(h.symbol, Number.isFinite(p) ? p : 0);
      }

      const quoteRefreshAt = refreshRes.bundle.lastQuoteRefreshAt ?? now;

      for (const sym of uniqueSymbols) {
        const newPrice = priceMap[sym];
        const fromQuoteResponse = newPrice != null && newPrice > 0;
        const before = beforePriceBySym.get(sym) ?? 0;
        const after = afterPriceBySym.get(sym) ?? 0;
        const holdingPriceUpdated = after > 0 && after !== before;

        if (fromQuoteResponse || holdingPriceUpdated) {
          newSymbolTimes.set(sym, quoteRefreshAt);
        } else {
          failed.add(sym);
        }
      }

      persistSymbolRefreshedAt(new Map([...symbolRefreshedAt, ...newSymbolTimes]));
      setRefreshFailedSymbols(failed);
      persistLastRefreshedAt(quoteRefreshAt);
      syncOptionalBrowserCacheFromBundle(refreshRes.bundle);
      await load();
    } catch (e) {
      console.error("[Holdings] 시세 갱신 오류:", e);
    } finally {
      setPriceRefreshing(false);
    }
  }

  async function handleDeleteGroup(group: GroupedHolding) {
    setDeleting(true);
    setError(null);
    try {
      for (const row of group.rows) {
        await deleteHolding(row.id);
      }
      setDeleteGroup(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
    } finally {
      setDeleting(false);
    }
  }

  // ── 데이터 분류 ────────────────────────────────────────────

  const regularHoldings = holdings.filter(
    (h) => !CASH_TYPES.has(h.asset_type ?? "") && h.asset_type !== "BOND"
  );
  const groupedHoldings = groupRegularHoldings(regularHoldings);

  // 채권 — 통화별로 그룹핑 (화면엔 1줄, DB엔 개별 row)
  // useMemo로 참조 안정화: BondEditModal의 useEffect가 매 렌더마다 재실행되어 입력값 초기화 방지
  const bondGroups = useMemo(() => {
    const map = new Map<"KRW" | "USD", AssetSnapshotHolding[]>();
    holdings
      .filter((h) => h.asset_type === "BOND")
      .forEach((h) => {
        const cur = (h.currency ?? "KRW") as "KRW" | "USD";
        if (!map.has(cur)) map.set(cur, []);
        map.get(cur)!.push(h);
      });
    return map;
  }, [holdings]);

  // useMemo로 안정화 — 참조가 바뀌면 CashEditModal의 useEffect가
  // 매 렌더마다 재실행되어 입력값이 초기화되는 문제 방지
  const cashGroups = useMemo(() => {
    const map = new Map<string, AssetSnapshotHolding[]>();
    holdings
      .filter((h) => CASH_TYPES.has(h.asset_type ?? ""))
      .forEach((h) => {
        const key = h.asset_type ?? "";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(h);
      });
    return map;
  }, [holdings]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (holdings.length === 0) return;
    for (const [assetType, rows] of cashGroups) {
      const sum = rows.reduce((s, r) => s + r.evaluated_amount, 0);
      console.debug("[HoldingsCash] 테이블 집계 (렌더 기준)", {
        assetType,
        rowCount: rows.length,
        perRow: rows.map((r) => ({
          id: r.id,
          account: r.account,
          evaluated_amount: r.evaluated_amount,
        })),
        sumEvaluatedAmount: sum,
      });
    }
  }, [holdings, cashGroups]);

  /** 대시보드·자산비율 차트와 동일: 전체 자산 = 원화 합 + (달러 합 × 환율) */
  const totalAssetsKRW = useMemo(() => {
    const krwAssets = holdings
      .filter((h) => h.currency === "KRW")
      .reduce((s, h) => s + h.evaluated_amount, 0);
    const usdAssets = holdings
      .filter((h) => h.currency === "USD")
      .reduce((s, h) => s + h.evaluated_amount, 0);
    return krwAssets + usdAssets * usdKrw.rate;
  }, [holdings, usdKrw.rate]);

  const TABLE_COLS = [
    { label: "종목명",   align: "left"  },
    { label: "티커",     align: "left"  },
    { label: "계좌",     align: "left"  },
    { label: "자산유형", align: "left"  },
    { label: "보유수량", align: "right" },
    { label: "평균단가", align: "right" },
    { label: "현재가",   align: "right" },
    { label: "평가금액", align: "right" },
    { label: "평가손익", align: "right" },
    { label: "목표 비중", align: "right" },
    { label: "상태",     align: "left"  },
    { label: "",         align: "right" },
  ] as const;

  // ── 렌더 ──────────────────────────────────────────────────

  return (
    <div className="px-6 py-8 space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">보유현황</h1>
          <p className="text-sm text-gray-400 mt-0.5">가장 최신 기준일의 보유 종목</p>
          <p className="text-xs text-gray-400 mt-1">
            비중·BUY/HOLD/SELL은 전체 자산(KRW+USD 환산, 환율 {usdKrw.rate.toLocaleString()}원/USD) 기준
          </p>
          {lastRefreshedAt ? (
            <p className="text-xs text-gray-400 mt-1">
              마지막 갱신 {fmtDateTime(lastRefreshedAt)}
            </p>
          ) : (
            <p className="text-xs text-gray-300 mt-1">시세 미갱신 — 저장된 현재가 기준</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePriceRefresh}
            disabled={priceRefreshing || holdings.length === 0}
            title="현재가 새로고침"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${priceRefreshing ? "animate-spin" : ""}`} />
            {priceRefreshing ? "조회중..." : "현재가 갱신"}
          </button>
          <button
            onClick={() => setAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#5b6af4] hover:bg-[#4f5fe0] transition-all shadow-sm shadow-indigo-200"
          >
            <Plus className="w-4 h-4" />
            종목 추가
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-[#5b6af4] animate-spin" />
        </div>
      ) : holdings.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm flex flex-col items-center justify-center py-24 gap-3 text-center">
          <PackageOpen className="w-10 h-10 text-gray-200" />
          <p className="text-sm font-medium text-gray-400">보유 종목이 없습니다</p>
          <p className="text-xs text-gray-300">우측 상단 버튼으로 종목을 추가해주세요</p>
        </div>
      ) : (
        <div className="space-y-5">
          {CURRENCY_SECTIONS.map((sec) => {
            const sectionGroups      = groupedHoldings.filter((g) => g.currency === sec.currency);
            const sectionCashEntries = [...cashGroups.entries()].filter(
              ([assetType]) => CASH_META[assetType]?.currency === sec.currency
            );
            const sectionBondRows  = bondGroups.get(sec.currency as "KRW" | "USD") ?? [];
            const hasBonds         = sectionBondRows.length > 0;
            const bondSectionTotal = sectionBondRows.reduce((s, r) => s + r.evaluated_amount, 0);

            // 채권 row는 데이터 유무와 관계없이 항상 1줄 표시 (예수금처럼 기본 항목)
            const displayCount = sectionGroups.length + sectionCashEntries.length + 1;
            if (displayCount === 0) return null;

            // 섹션 소계 = 일반 종목(저장된 currentPrice 기준) + 채권 + 예수금 합산
            const sectionTotal =
              sectionGroups.reduce((s, g) => s + g.evaluatedAmount, 0) +
              bondSectionTotal +
              sectionCashEntries
                .flatMap(([, rows]) => rows)
                .reduce((s, r) => s + r.evaluated_amount, 0);

            return (
              <div
                key={sec.currency}
                className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden"
              >
                {/* 섹션 헤더 */}
                <div className={clsx(
                  "px-5 py-4 border-b border-gray-100 flex items-center justify-between",
                  sec.headerClass
                )}>
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-gray-800">{sec.label}</h3>
                    <span className={clsx(
                      "text-[11px] font-semibold px-2 py-0.5 rounded-md",
                      sec.badgeClass
                    )}>
                      {displayCount}종목
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 mb-0.5">{sec.totalLabel}</p>
                    <p className="text-sm font-bold text-gray-800 tabular-nums">
                      {sec.formatTotal(sectionTotal)}
                    </p>
                  </div>
                </div>

                {/* 테이블 */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50">
                        {TABLE_COLS.map((col, i) => (
                          <th
                            key={i}
                            className={clsx(
                              "px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap",
                              col.align === "right" ? "text-right" : "text-left"
                            )}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">

                      {/* ── 일반 종목 (그룹 통합 표시) ── */}
                      {sectionGroups.map((g) => {
                        const storedPrice   = g.currentPrice;
                        const evalAmount    = g.evaluatedAmount;
                        const evalKRW       = evalAmountToKrw(evalAmount, g.currency, usdKrw.rate);
                        const weight        =
                          totalAssetsKRW > 0 ? (evalKRW / totalAssetsKRW) * 100 : 0;
                        const isFailed      = refreshFailedSymbols.has(g.symbol);
                        const priceUpdated  = symbolRefreshedAt.get(g.symbol) ?? null;

                        // 계좌 표시: 실제 계좌명 리스트 (최대 2개, 초과 시 "외 N개" + tooltip)
                        const accountInfo = formatAccountList(g.rows);

                        // 평가손익 계산
                        const costBasis = g.totalQuantity * g.weightedAvgPrice;
                        const pnl       = evalAmount - costBasis;
                        const pnlRate   = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
                        const pnlColor  =
                          pnl > 0
                            ? "text-red-500"
                            : pnl < 0
                            ? "text-blue-500"
                            : "text-gray-400";

                        const refBand = g.rows[0];
                        const tMinRow   = refBand?.target_min_weight;
                        const tMaxRow   = refBand?.target_max_weight;
                        const bandForRow =
                          g.asset_type === "STOCK" &&
                          hasValidTargetBand(tMinRow, tMaxRow) &&
                          tMinRow != null &&
                          tMaxRow != null;
                        const allocationStatus = bandForRow
                          ? computeAllocationSignal(weight, tMinRow, tMaxRow).status
                          : null;

                        return (
                          <tr
                            key={g.groupKey}
                            className={clsx(
                              "transition-colors",
                              allocationStatus === "BUY" &&
                                "bg-blue-50 border-l-4 border-blue-500 hover:bg-blue-100",
                              allocationStatus === "HOLD" &&
                                "bg-gray-50 border-l-4 border-gray-400 hover:bg-gray-100",
                              allocationStatus === "SELL" &&
                                "bg-red-50 border-l-4 border-red-500 hover:bg-red-100",
                              !allocationStatus && "hover:bg-gray-50/60"
                            )}
                          >
                            <td className="px-4 py-3.5">
                              <span className="font-semibold text-gray-800">{g.name}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                {g.symbol || "-"}
                              </span>
                            </td>
                            <td
                              className="px-4 py-3.5 text-xs text-gray-500 cursor-default"
                              title={accountInfo.short !== accountInfo.full ? accountInfo.full : undefined}
                            >
                              {accountInfo.short}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={clsx(
                                "text-xs font-medium px-2 py-0.5 rounded-lg border whitespace-nowrap",
                                MARKET_BADGE[g.market ?? ""] ?? "bg-gray-50 text-gray-500 border-gray-100"
                              )}>
                                {(ASSET_TYPE_LABELS[g.asset_type as AssetType] ?? g.asset_type) || "-"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums text-gray-700 font-medium">
                              {g.totalQuantity.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums text-gray-500">
                              {fmtAmount(g.weightedAvgPrice, g.currency)}
                            </td>
                            <td className="px-4 py-3.5 text-right tabular-nums">
                              <span className="flex flex-col items-end gap-0.5">
                                <span className={storedPrice > 0 ? "text-gray-700 font-semibold" : "text-gray-400 font-medium"}>
                                  {storedPrice > 0 ? fmtAmount(storedPrice, g.currency) : "—"}
                                </span>
                                {isFailed ? (
                                  <span className="text-[10px] text-orange-400 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-md">
                                    갱신 실패
                                  </span>
                                ) : priceUpdated ? (
                                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                    {fmtDateTime(priceUpdated)}
                                  </span>
                                ) : null}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className="tabular-nums text-gray-800 font-semibold">
                                  {fmtAmount(evalAmount, g.currency)}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[#5b6af4] rounded-full"
                                      style={{ width: `${Math.min(weight, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-gray-400 tabular-nums">
                                    {weight.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </td>
                            {/* 평가손익 */}
                            <td className="px-4 py-3.5 text-right">
                              {storedPrice > 0 ? (
                                <div className={clsx("flex flex-col items-end gap-0.5 tabular-nums font-semibold", pnlColor)}>
                                  <span>{fmtPnL(pnl, g.currency)}</span>
                                  <span className="text-[11px] font-medium">
                                    {pnl > 0 ? "+" : ""}{pnlRate.toFixed(2)}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                            {/* Goal band & signal — STOCK only when min/max band valid */}
                            <td className="px-4 py-3.5 text-right">
                              {(() => {
                                const refRow = g.rows[0];
                                const tMin = refRow?.target_min_weight;
                                const tMax = refRow?.target_max_weight;
                                const bandOk =
                                  g.asset_type === "STOCK" &&
                                  hasValidTargetBand(tMin, tMax) &&
                                  tMin != null &&
                                  tMax != null;
                                return bandOk ? (
                                  <span className="text-xs text-gray-600 tabular-nums">
                                    {formatTargetRange(tMin, tMax)}
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3.5">
                              {(() => {
                                const refRow = g.rows[0];
                                const tMin = refRow?.target_min_weight;
                                const tMax = refRow?.target_max_weight;
                                const bandOk =
                                  g.asset_type === "STOCK" &&
                                  hasValidTargetBand(tMin, tMax) &&
                                  tMin != null &&
                                  tMax != null;
                                if (!bandOk) {
                                  return <span className="text-gray-300">—</span>;
                                }
                                const { status, diffPercent } = computeAllocationSignal(
                                  weight,
                                  tMin,
                                  tMax
                                );
                                return (
                                  <div className="flex flex-col gap-0.5 items-start">
                                    <span
                                      className={clsx(
                                        "text-xs font-bold",
                                        status === "BUY" && "text-blue-600",
                                        status === "HOLD" && "text-emerald-600",
                                        status === "SELL" && "text-red-600"
                                      )}
                                    >
                                      {status}
                                    </span>
                                    {status !== "HOLD" && diffPercent != null && (
                                      <span
                                        className={clsx(
                                          "text-[11px] tabular-nums font-medium",
                                          status === "BUY" && "text-blue-500",
                                          status === "SELL" && "text-red-500"
                                        )}
                                      >
                                        {formatDiffLabel(diffPercent)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => setEditGroup(g)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-[#5b6af4] hover:bg-indigo-50 transition-colors"
                                  title="수정"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteGroup(g)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                  title="삭제"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {/* ── 채권 통합 row (통화별 1행, 데이터 없어도 항상 표시) ── */}
                      {(() => {
                        const bondEvalKrw = evalAmountToKrw(bondSectionTotal, sec.currency, usdKrw.rate);
                        const bondWeight =
                          totalAssetsKRW > 0 ? (bondEvalKrw / totalAssetsKRW) * 100 : 0;
                        const bondLabel  = sec.currency === "KRW" ? "원화채권" : "달러채권";

                        // 보유 채권명 요약 표시
                        const bondNames   = sectionBondRows.map((r) => r.name);
                        const bondSubText = !hasBonds
                          ? "보유 채권 없음 · 수정 버튼으로 추가"
                          : bondNames.length === 1
                          ? bondNames[0]
                          : `${bondNames[0]} 외 ${bondNames.length - 1}건`;

                        // 계좌 표시 (잔고 > 0인 행 기준, 중복 제거)
                        const bondAccountLabels = [
                          ...new Set(
                            sectionBondRows
                              .filter((r) => r.evaluated_amount > 0 && r.account && ACCOUNTS.includes(r.account as Account))
                              .map((r) => ACCOUNT_LABELS[r.account as Account])
                          ),
                        ];
                        const bondAccountShort =
                          bondAccountLabels.length === 0
                            ? "—"
                            : bondAccountLabels.length <= 2
                            ? bondAccountLabels.join(", ")
                            : `${bondAccountLabels.slice(0, 2).join(", ")} 외 ${bondAccountLabels.length - 2}개`;

                        return (
                          <tr
                            key="bond-row"
                            className="hover:bg-violet-50/30 transition-colors bg-violet-50/10"
                          >
                            <td className="px-4 py-3.5">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className={`font-semibold ${hasBonds ? "text-gray-800" : "text-gray-400"}`}>{bondLabel}</span>
                                  <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-md">
                                    채권
                                  </span>
                                </div>
                                <span className={`text-[11px] ${hasBonds ? "text-gray-400" : "text-gray-300 italic"}`}>{bondSubText}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-gray-300 text-xs">—</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-xs text-gray-400">{bondAccountShort}</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-xs font-medium px-2 py-0.5 rounded-lg border bg-violet-50 text-violet-600 border-violet-100 whitespace-nowrap">
                                채권
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span className="text-gray-300">—</span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span className="text-gray-300">—</span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span className="text-gray-300">—</span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              {hasBonds ? (
                                <div className="flex flex-col items-end gap-1">
                                  <span className="tabular-nums text-gray-800 font-semibold">
                                    {fmtAmount(bondSectionTotal, sec.currency)}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-violet-400 rounded-full"
                                        style={{ width: `${Math.min(bondWeight, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-violet-400 tabular-nums">
                                      {bondWeight.toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-300 tabular-nums">
                                  {sec.currency === "KRW" ? "0원" : "$0.00"}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span className="text-gray-300">—</span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span className="text-gray-300">—</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-gray-300">—</span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                onClick={() => setBondModalCurrency(sec.currency as "KRW" | "USD")}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-violet-500 hover:bg-violet-50 transition-colors"
                                title="채권 관리"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })()}

                      {/* ── 예수금 병합 row (asset_type 당 1행) ── */}
                      {sectionCashEntries.map(([assetType, rows]) => {
                        const meta = CASH_META[assetType];
                        if (!meta) return null;

                        const cashTotal    = rows.reduce((s, r) => s + r.evaluated_amount, 0);
                        const nonZeroCount = rows.filter((r) => r.evaluated_amount > 0).length;
                        const cashEvalKrw  = evalAmountToKrw(cashTotal, meta.currency, usdKrw.rate);
                        const weight       =
                          totalAssetsKRW > 0 ? (cashEvalKrw / totalAssetsKRW) * 100 : 0;

                        return (
                          <tr
                            key={assetType}
                            className="hover:bg-amber-50/30 transition-colors bg-amber-50/10"
                          >
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-800">{meta.name}</span>
                                <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md">
                                  예수금
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-gray-300 text-xs">—</span>
                            </td>
                            <td className="px-4 py-3.5">
                              {(() => {
                                const cashAccountLabels = rows
                                  .filter((r) => r.evaluated_amount > 0 && ACCOUNTS.includes(r.account as Account))
                                  .map((r) => ACCOUNT_LABELS[r.account as Account]);
                                if (cashAccountLabels.length === 0) {
                                  return <span className="text-xs text-gray-300">—</span>;
                                }
                                const full  = cashAccountLabels.join(", ");
                                const short = cashAccountLabels.length <= 2
                                  ? full
                                  : `${cashAccountLabels.slice(0, 2).join(", ")} 외 ${cashAccountLabels.length - 2}개`;
                                return (
                                  <span
                                    className="text-xs text-gray-400 cursor-default"
                                    title={short !== full ? full : undefined}
                                  >
                                    {short}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-xs font-medium px-2 py-0.5 rounded-lg border bg-amber-50 text-amber-600 border-amber-100 whitespace-nowrap">
                                {ASSET_TYPE_LABELS[assetType as AssetType] ?? assetType}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span className="text-gray-300">—</span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span className="text-gray-300">—</span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span className="text-gray-300">—</span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <span className="tabular-nums text-gray-800 font-semibold">
                                  {fmtAmount(cashTotal, meta.currency)}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-amber-400 rounded-full"
                                      style={{ width: `${Math.min(weight, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-amber-500 tabular-nums">
                                    {weight.toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </td>
                            {/* 예수금은 평가손익 없음 */}
                            <td className="px-4 py-3.5 text-right">
                              <span className="text-gray-300">—</span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <span className="text-gray-300">—</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="text-gray-300">—</span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                onClick={() => {
                                  const cashType = assetType as CashAssetType;
                                  if (process.env.NODE_ENV === "development") {
                                    const r = cashGroups.get(cashType) ?? [];
                                    console.debug("[HoldingsCash] 예수금 수정 클릭", {
                                      cashType,
                                      rowCount: r.length,
                                      rows: r.map((x) => ({
                                        id: x.id,
                                        account: x.account,
                                        evaluated_amount: x.evaluated_amount,
                                      })),
                                    });
                                  }
                                  setCashModalType(cashType);
                                }}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                                title="예수금 수정"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 종목 추가 모달 */}
      <AddHoldingModal
        open={addModalOpen}
        snapshotDate={snapshotDate}
        onClose={() => setAddModalOpen(false)}
        onSaved={load}
      />

      {/* 일반 종목 수정 모달 (계좌별) */}
      <EditGroupedHoldingModal
        open={editGroup !== null}
        group={editGroup}
        snapshotDate={snapshotDate}
        onClose={() => setEditGroup(null)}
        onSaved={load}
      />

      {/* 예수금 전용 수정 모달 */}
      <CashEditModal
        open={cashModalType !== null}
        assetType={cashModalType}
        existingRows={cashModalType ? (cashGroups.get(cashModalType) ?? []) : []}
        snapshotDate={snapshotDate}
        onClose={() => setCashModalType(null)}
        onSaved={load}
      />

      {/* 채권 관리 모달 */}
      <BondEditModal
        open={bondModalCurrency !== null}
        currency={bondModalCurrency}
        existingRows={bondModalCurrency ? (bondGroups.get(bondModalCurrency) ?? []) : []}
        snapshotDate={snapshotDate}
        onClose={() => setBondModalCurrency(null)}
        onSaved={load}
      />

      {/* 그룹 삭제 확인 모달 */}
      {deleteGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 w-full max-w-sm mx-4">
            <div className="flex items-start gap-3 mb-5">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                <Trash2 className="w-4 h-4 text-red-500" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900">종목 삭제</h4>
                <p className="text-xs text-gray-500 mt-1">
                  <strong>{deleteGroup.name}</strong>의 모든 계좌 보유 내역
                  ({deleteGroup.rows.length}건)을 삭제하시겠습니까?
                  <br />이 작업은 되돌릴 수 없습니다.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteGroup(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleDeleteGroup(deleteGroup)}
                disabled={deleting}
                className="flex-1 flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
