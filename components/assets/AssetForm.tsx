"use client";

import { useState, useEffect } from "react";
import { X, Plus, Pencil, TrendingUp } from "lucide-react";
import type {
  Asset,
  AssetAction,
  AssetMarket,
  AssetCurrency,
} from "@/types/assets";
import { generateId } from "@/lib/assets";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormData = {
  name: string;
  action: AssetAction;
  market: AssetMarket;
  symbol: string;
  currency: AssetCurrency;
  currentPrice: string;
  quantity: string;
  buyAmount: string;
  evaluationAmount: string;
  currentWeight: string;
  minWeight: string;
  maxWeight: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

interface Props {
  onSubmit: (asset: Asset) => void;
  onClose: () => void;
  editAsset?: Asset | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIONS: { value: AssetAction; label: string; color: string }[] = [
  { value: "BUY", label: "매수", color: "text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100" },
  { value: "HOLD", label: "보유", color: "text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100" },
  { value: "SELL", label: "매도", color: "text-red-600 bg-red-50 border-red-200 hover:bg-red-100" },
];

const MARKETS: { value: AssetMarket; label: string; flag: string }[] = [
  { value: "KRX", label: "KRX", flag: "🇰🇷" },
  { value: "NASDAQ", label: "NASDAQ", flag: "🇺🇸" },
  { value: "NYSE", label: "NYSE", flag: "🇺🇸" },
  { value: "ETC", label: "기타", flag: "🌐" },
  { value: "CASH", label: "예수금", flag: "💵" },
];

const CURRENCIES: { value: AssetCurrency; label: string }[] = [
  { value: "KRW", label: "KRW ₩" },
  { value: "USD", label: "USD $" },
];

const EMPTY: FormData = {
  name: "",
  action: "HOLD",
  market: "KRX",
  symbol: "",
  currency: "KRW",
  currentPrice: "",
  quantity: "",
  buyAmount: "",
  evaluationAmount: "",
  currentWeight: "",
  minWeight: "",
  maxWeight: "",
};

function assetToForm(asset: Asset): FormData {
  return {
    name: asset.name,
    action: asset.action,
    market: asset.market,
    symbol: asset.symbol,
    currency: asset.currency,
    currentPrice: asset.currentPrice.toString(),
    quantity: asset.quantity.toString(),
    buyAmount: asset.buyAmount.toString(),
    evaluationAmount: asset.evaluationAmount.toString(),
    currentWeight: asset.currentWeight.toString(),
    minWeight: asset.minWeight.toString(),
    maxWeight: asset.maxWeight.toString(),
  };
}

// ---------------------------------------------------------------------------
// AssetForm
// ---------------------------------------------------------------------------

export default function AssetForm({ onSubmit, onClose, editAsset }: Props) {
  const [form, setForm] = useState<FormData>(
    editAsset ? assetToForm(editAsset) : EMPTY
  );
  const [errors, setErrors] = useState<FormErrors>({});

  const isEdit = !!editAsset;

  useEffect(() => {
    if (editAsset) setForm(assetToForm(editAsset));
  }, [editAsset]);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  // Auto-compute profit & returnRate from buyAmount and evaluationAmount
  const buyAmt = parseFloat(form.buyAmount) || 0;
  const evalAmt = parseFloat(form.evaluationAmount) || 0;
  const computedProfit = evalAmt - buyAmt;
  const computedReturnRate =
    buyAmt > 0 ? (computedProfit / buyAmt) * 100 : 0;

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = "종목명을 입력하세요";
    if (!form.symbol.trim()) e.symbol = "티커를 입력하세요";
    if (!form.currentPrice || parseFloat(form.currentPrice) < 0)
      e.currentPrice = "0 이상 입력하세요";
    if (!form.quantity || parseInt(form.quantity) < 0)
      e.quantity = "0 이상 입력하세요";
    if (!form.buyAmount || parseFloat(form.buyAmount) < 0)
      e.buyAmount = "0 이상 입력하세요";
    if (!form.evaluationAmount || parseFloat(form.evaluationAmount) < 0)
      e.evaluationAmount = "0 이상 입력하세요";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const asset: Asset = {
      id: editAsset?.id ?? generateId(),
      name: form.name.trim(),
      action: form.action,
      market: form.market,
      symbol: form.symbol.trim().toUpperCase(),
      currency: form.currency,
      currentPrice: parseFloat(form.currentPrice) || 0,
      quantity: parseInt(form.quantity) || 0,
      buyAmount: parseFloat(form.buyAmount) || 0,
      evaluationAmount: parseFloat(form.evaluationAmount) || 0,
      profit: computedProfit,
      returnRate: computedReturnRate,
      currentWeight: parseFloat(form.currentWeight) || 0,
      minWeight: parseFloat(form.minWeight) || 0,
      maxWeight: parseFloat(form.maxWeight) || 0,
    };

    onSubmit(asset);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#eef0fe] flex items-center justify-center">
              {isEdit ? (
                <Pencil className="w-4 h-4 text-[#5b6af4]" />
              ) : (
                <TrendingUp className="w-4 h-4 text-[#5b6af4]" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {isEdit ? "자산 수정" : "자산 추가"}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {isEdit
                  ? "자산 정보를 수정합니다"
                  : "포트폴리오에 새 자산을 등록합니다"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Form body */}
        <form
          onSubmit={handleSubmit}
          className="px-6 py-5 space-y-5 overflow-y-auto flex-1"
        >
          {/* 종목명 + 티커 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="종목명" error={errors.name}>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="예: 삼성전자"
                className={inputCls(!!errors.name)}
              />
            </Field>
            <Field label="티커 (Symbol)" error={errors.symbol}>
              <input
                type="text"
                value={form.symbol}
                onChange={(e) =>
                  set("symbol", e.target.value.toUpperCase())
                }
                placeholder="예: 005930"
                className={inputCls(!!errors.symbol)}
              />
            </Field>
          </div>

          {/* 리밸런싱 액션 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              리밸런싱 액션
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ACTIONS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => set("action", a.value)}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-all ${
                    form.action === a.value
                      ? a.color + " shadow-sm"
                      : "bg-gray-50 text-gray-400 border-gray-100 hover:bg-gray-100"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* 거래소 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              거래소
            </label>
            <div className="flex gap-2 flex-wrap">
              {MARKETS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => set("market", m.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                    form.market === m.value
                      ? "bg-[#5b6af4] text-white border-[#5b6af4] shadow-sm shadow-indigo-200"
                      : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"
                  }`}
                >
                  <span className="text-base leading-none">{m.flag}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 통화 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              통화
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => set("currency", c.value)}
                  className={`py-2 rounded-xl text-sm font-semibold border transition-all ${
                    form.currency === c.value
                      ? "bg-[#5b6af4] text-white border-[#5b6af4] shadow-sm"
                      : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* 현재가 + 수량 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="현재가" error={errors.currentPrice}>
              <input
                type="number"
                value={form.currentPrice}
                onChange={(e) => set("currentPrice", e.target.value)}
                placeholder="예: 186200"
                min={0}
                step="any"
                className={inputCls(!!errors.currentPrice)}
              />
            </Field>
            <Field label="수량" error={errors.quantity}>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
                placeholder="예: 10"
                min={0}
                className={inputCls(!!errors.quantity)}
              />
            </Field>
          </div>

          {/* 매입금액 + 평가금액 */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="매입금액 (원)" error={errors.buyAmount}>
              <input
                type="number"
                value={form.buyAmount}
                onChange={(e) => set("buyAmount", e.target.value)}
                placeholder="예: 1666067"
                min={0}
                className={inputCls(!!errors.buyAmount)}
              />
            </Field>
            <Field label="평가금액 (원)" error={errors.evaluationAmount}>
              <input
                type="number"
                value={form.evaluationAmount}
                onChange={(e) => set("evaluationAmount", e.target.value)}
                placeholder="예: 2420600"
                min={0}
                className={inputCls(!!errors.evaluationAmount)}
              />
            </Field>
          </div>

          {/* Auto-computed profit preview */}
          {(buyAmt > 0 || evalAmt > 0) && (
            <div
              className={`rounded-xl p-3.5 border ${
                computedProfit >= 0
                  ? "bg-emerald-50/50 border-emerald-100"
                  : "bg-red-50/50 border-red-100"
              }`}
            >
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                자동 계산
              </p>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] text-gray-400">평가손익</p>
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      computedProfit >= 0
                        ? "text-emerald-600"
                        : "text-red-500"
                    }`}
                  >
                    {computedProfit >= 0 ? "+" : ""}
                    {computedProfit.toLocaleString()}원
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">수익률</p>
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      computedReturnRate >= 0
                        ? "text-emerald-600"
                        : "text-red-500"
                    }`}
                  >
                    {computedReturnRate >= 0 ? "+" : ""}
                    {computedReturnRate.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 비중 설정 */}
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-2">
              비중 설정 (%)
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="현재비중">
                <input
                  type="number"
                  value={form.currentWeight}
                  onChange={(e) => set("currentWeight", e.target.value)}
                  placeholder="예: 5.5"
                  min={0}
                  max={100}
                  step="0.01"
                  className={inputCls(false)}
                />
              </Field>
              <Field label="최소비중">
                <input
                  type="number"
                  value={form.minWeight}
                  onChange={(e) => set("minWeight", e.target.value)}
                  placeholder="예: 3"
                  min={0}
                  max={100}
                  step="0.1"
                  className={inputCls(false)}
                />
              </Field>
              <Field label="최대비중">
                <input
                  type="number"
                  value={form.maxWeight}
                  onChange={(e) => set("maxWeight", e.target.value)}
                  placeholder="예: 10"
                  min={0}
                  max={100}
                  step="0.1"
                  className={inputCls(false)}
                />
              </Field>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors border border-gray-100"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#5b6af4] hover:bg-[#4a58e8] active:bg-[#3a47d8] transition-colors flex items-center justify-center gap-2 shadow-sm shadow-indigo-200"
            >
              {isEdit ? (
                <>
                  <Pencil className="w-4 h-4" />
                  수정 완료
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  추가하기
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inputCls(hasError: boolean): string {
  return [
    "w-full px-3.5 py-2.5 rounded-xl border text-sm text-gray-800 placeholder-gray-300 outline-none transition-all",
    hasError
      ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-100"
      : "border-gray-200 bg-white focus:border-[#5b6af4] focus:ring-2 focus:ring-[#5b6af4]/10",
  ].join(" ");
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-[11px] text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}
