"use client";

import { useState } from "react";
import { X, Save, Loader2, AlertCircle } from "lucide-react";
import clsx from "clsx";
import type { AssetTransaction } from "@/types/transactions";
import { insertTransaction, updateTransaction } from "@/lib/transactions";

interface TransactionFormProps {
  initial?: AssetTransaction | null;
  onSuccess: (tx: AssetTransaction) => void;
  onCancel?: () => void;
  isModal?: boolean;
}

const MARKETS = ["KRX", "NASDAQ", "NYSE", "ETC"];
const CURRENCIES = ["KRW", "USD", "EUR", "JPY"];

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4] transition-all";

export default function TransactionForm({
  initial,
  onSuccess,
  onCancel,
  isModal = false,
}: TransactionFormProps) {
  const isEdit = !!initial;

  const [form, setForm] = useState({
    trade_date: initial?.trade_date?.slice(0, 10) ?? "",
    type: initial?.type ?? "BUY",
    name: initial?.name ?? "",
    symbol: initial?.symbol ?? "",
    market: initial?.market ?? "KRX",
    currency: initial?.currency ?? "KRW",
    quantity: initial?.quantity?.toString() ?? "",
    unit_price: initial?.unit_price?.toString() ?? "",
    fee: initial?.fee?.toString() ?? "",
    memo: initial?.memo ?? "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => ({ ...p, [field]: "" }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.trade_date) errs.trade_date = "거래일을 입력하세요";
    if (!form.name.trim()) errs.name = "종목명을 입력하세요";
    if (!form.symbol.trim()) errs.symbol = "티커를 입력하세요";
    if (!form.quantity || isNaN(+form.quantity) || +form.quantity <= 0)
      errs.quantity = "수량을 올바르게 입력하세요";
    if (!form.unit_price || isNaN(+form.unit_price) || +form.unit_price <= 0)
      errs.unit_price = "단가를 올바르게 입력하세요";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiError(null);

    const qty = parseFloat(form.quantity);
    const price = parseFloat(form.unit_price);
    const fee = form.fee ? parseFloat(form.fee) : null;

    const payload = {
      trade_date: new Date(form.trade_date).toISOString(),
      type: form.type as "BUY" | "SELL",
      name: form.name.trim(),
      symbol: form.symbol.trim().toUpperCase(),
      market: form.market,
      currency: form.currency,
      quantity: qty,
      unit_price: price,
      total_amount: qty * price,
      fee,
      memo: form.memo.trim() || null,
    };

    try {
      const tx = isEdit
        ? await updateTransaction(initial!.id, payload)
        : await insertTransaction(payload);
      onSuccess(tx);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "저장 중 오류 발생");
    } finally {
      setLoading(false);
    }
  }

  const formContent = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="거래일" required error={errors.trade_date}>
          <input
            type="date"
            value={form.trade_date}
            onChange={(e) => set("trade_date", e.target.value)}
            className={clsx(inputCls, errors.trade_date && "border-red-300")}
          />
        </Field>
        <Field label="거래유형" required>
          <div className="flex gap-2">
            {(["BUY", "SELL"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set("type", t)}
                className={clsx(
                  "flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all",
                  form.type === t
                    ? t === "BUY"
                      ? "bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-200"
                      : "bg-red-500 border-red-500 text-white shadow-sm shadow-red-200"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                )}
              >
                {t === "BUY" ? "매수" : "매도"}
              </button>
            ))}
          </div>
        </Field>
        <Field label="시장" required>
          <select
            value={form.market}
            onChange={(e) => set("market", e.target.value)}
            className={inputCls}
          >
            {MARKETS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="종목명" required error={errors.name}>
          <input
            type="text"
            placeholder="예: 삼성전자"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className={clsx(inputCls, errors.name && "border-red-300")}
          />
        </Field>
        <Field label="티커" required error={errors.symbol}>
          <input
            type="text"
            placeholder="예: 005930 / NVDA"
            value={form.symbol}
            onChange={(e) => set("symbol", e.target.value.toUpperCase())}
            className={clsx(inputCls, errors.symbol && "border-red-300", "font-mono")}
          />
        </Field>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="통화" required>
          <select
            value={form.currency}
            onChange={(e) => set("currency", e.target.value)}
            className={inputCls}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="수량" required error={errors.quantity}>
          <input
            type="number"
            placeholder="0"
            min="0"
            step="any"
            value={form.quantity}
            onChange={(e) => set("quantity", e.target.value)}
            className={clsx(inputCls, errors.quantity && "border-red-300")}
          />
        </Field>
        <Field label="단가" required error={errors.unit_price}>
          <input
            type="number"
            placeholder="0"
            min="0"
            step="any"
            value={form.unit_price}
            onChange={(e) => set("unit_price", e.target.value)}
            className={clsx(inputCls, errors.unit_price && "border-red-300")}
          />
        </Field>
      </div>

      {/* Total preview */}
      {form.quantity && form.unit_price && (
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-600 flex items-center justify-between">
          <span className="font-medium">총 거래금액</span>
          <span className="font-bold text-gray-800 tabular-nums">
            {(+form.quantity * +form.unit_price).toLocaleString()}
            {form.currency === "USD" ? " USD" : " KRW"}
          </span>
        </div>
      )}

      {/* Row 4 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="수수료 (선택)">
          <input
            type="number"
            placeholder="0"
            min="0"
            step="any"
            value={form.fee}
            onChange={(e) => set("fee", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="메모 (선택)">
          <input
            type="text"
            placeholder="메모"
            value={form.memo}
            onChange={(e) => set("memo", e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      {/* Error */}
      {apiError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {apiError}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-all"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#5b6af4] hover:bg-[#4a58e8] disabled:opacity-60 transition-all shadow-sm shadow-indigo-200"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isEdit ? "수정 완료" : "거래 저장"}
        </button>
      </div>
    </form>
  );

  if (!isModal) return formContent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {isEdit ? "거래 수정" : "신규 거래 입력"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              거래 내역을 직접 입력하세요
            </p>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="px-6 py-5">{formContent}</div>
      </div>
    </div>
  );
}
