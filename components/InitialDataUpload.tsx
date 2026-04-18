"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  Plus,
  PenLine,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { parseWorkbook, type ParseResult } from "@/lib/excelParser";
import {
  saveCashflows,
  saveSnapshots,
  getCashflows,
  getSnapshots,
  hasInitialData,
  clearAllData,
} from "@/lib/storage";
import type { Cashflow, AssetSnapshot } from "@/types/assets";

interface InitialDataUploadProps {
  onDataSaved?: () => void;
}

type UploadState = "idle" | "parsing" | "preview" | "saving" | "done" | "error";
type InputTab = "excel" | "manual";

// ─────────────────────────────────────────────────────────────
// 덮어쓰기 확인 모달
// ─────────────────────────────────────────────────────────────
function OverwriteModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">기존 데이터 덮어쓰기</h3>
            <p className="text-xs text-gray-400 mt-0.5">이 작업은 되돌릴 수 없습니다</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          이미 저장된 초기 데이터가 있습니다. 새 파일로 덮어쓰시겠습니까?
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#5b6af4] hover:bg-[#4a58e8] transition-all"
          >
            덮어쓰기
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 삭제 확인 모달
// ─────────────────────────────────────────────────────────────
function DeleteModal({
  label,
  onConfirm,
  onCancel,
}: {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
        <p className="text-sm font-semibold text-gray-800 mb-2">{label} 데이터를 전체 삭제할까요?</p>
        <p className="text-xs text-gray-400 mb-6">저장된 모든 항목이 삭제됩니다.</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100">취소</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600">삭제</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 캐시플로우 직접 입력 폼
// ─────────────────────────────────────────────────────────────
function CashflowInputForm({ onSaved }: { onSaved: () => void }) {
  const empty = { date: "", account: "", type: "DEPOSIT", amount: "", memo: "" };
  const [form, setForm] = useState(empty);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date || !form.amount) return;
    setSaving(true);
    try {
      const existing = await getCashflows();
      const newItem: Cashflow = {
        id: `cf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        flow_date:  form.date,
        type:       (form.type as Cashflow["type"]) || "DEPOSIT",
        account:    form.account || undefined,
        amount:     Math.abs(parseFloat(form.amount.replace(/,/g, ""))),
        memo:       form.memo || undefined,
        created_at: new Date().toISOString(),
      };
      await saveCashflows([...existing, newItem]);
      setForm(empty);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (e) {
      console.error("[CashflowInputForm] 저장 오류:", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">거래일자 *</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">구분</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
          >
            <option value="DEPOSIT">입금</option>
            <option value="WITHDRAW">출금</option>
            <option value="DIVIDEND">배당</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">금액 (원) *</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="예: 5000000"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">계좌</label>
          <input
            type="text"
            placeholder="예: 미래에셋"
            value={form.account}
            onChange={(e) => setForm({ ...form, account: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">메모</label>
        <input
          type="text"
          placeholder="비고"
          value={form.memo}
          onChange={(e) => setForm({ ...form, memo: e.target.value })}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#5b6af4] hover:bg-[#4a58e8] disabled:opacity-60 transition-all shadow-sm shadow-indigo-200"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        {saving ? "저장 중..." : saved ? "저장됨!" : "캐시플로우 추가"}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// 스냅샷 직접 입력 폼
// ─────────────────────────────────────────────────────────────
function SnapshotInputForm({ onSaved }: { onSaved: () => void }) {
  const empty = {
    snapshot_date: "",
    total_asset: "",
    net_investment: "",
    profit: "",
    return_rate: "",
  };
  const [form, setForm] = useState(empty);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.snapshot_date || !form.total_asset) return;
    setSaving(true);

    const toNum = (s: string) => {
      const n = parseFloat(s.replace(/,/g, ""));
      return isNaN(n) ? undefined : n;
    };

    try {
      const existing = await getSnapshots();
      const newSnap: AssetSnapshot = {
        id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        snapshot_date: form.snapshot_date,
        total_asset: toNum(form.total_asset) ?? 0,
        net_investment: toNum(form.net_investment),
        profit: toNum(form.profit),
        return_rate: toNum(form.return_rate),
        created_at: new Date().toISOString(),
      };

      const filtered = existing.filter((s) => s.snapshot_date !== newSnap.snapshot_date);
      await saveSnapshots(
        [...filtered, newSnap].sort((a, b) =>
          a.snapshot_date.localeCompare(b.snapshot_date)
        )
      );
      setForm(empty);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (e) {
      console.error("[SnapshotInputForm] 저장 오류:", e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">기준일 *</label>
          <input
            type="date"
            value={form.snapshot_date}
            onChange={(e) => setForm({ ...form, snapshot_date: e.target.value })}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">총자산 (원) *</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="예: 100000000"
            value={form.total_asset}
            onChange={(e) => setForm({ ...form, total_asset: e.target.value })}
            required
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">순투자금</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="예: 80000000"
            value={form.net_investment}
            onChange={(e) => setForm({ ...form, net_investment: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">수익금액</label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="예: 20000000"
            value={form.profit}
            onChange={(e) => setForm({ ...form, profit: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">수익률 (%)</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="예: 12.5"
            value={form.return_rate}
            onChange={(e) => setForm({ ...form, return_rate: e.target.value })}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/30 focus:border-[#5b6af4]"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition-all shadow-sm shadow-emerald-200"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        {saving ? "저장 중..." : saved ? "저장됨!" : "스냅샷 추가"}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────
// 저장된 데이터 목록 패널
// ─────────────────────────────────────────────────────────────
function StoredDataPanel({
  cashflows,
  snapshots,
  onClearCashflows,
  onClearSnapshots,
}: {
  cashflows: Cashflow[];
  snapshots: AssetSnapshot[];
  onClearCashflows: () => void;
  onClearSnapshots: () => void;
}) {
  const [openCf, setOpenCf] = useState(false);
  const [openSnap, setOpenSnap] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<"cashflow" | "snapshot" | null>(null);

  function formatNum(v: number) {
    return v.toLocaleString("ko-KR");
  }

  return (
    <div className="space-y-3">
      {deleteTarget && (
        <DeleteModal
          label={deleteTarget === "cashflow" ? "캐시플로우" : "스냅샷"}
          onConfirm={() => {
            if (deleteTarget === "cashflow") onClearCashflows();
            else onClearSnapshots();
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Cashflow panel */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div
          onClick={() => setOpenCf((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">캐시플로우</span>
            <span className="text-xs font-semibold text-[#5b6af4] bg-[#eef0fe] px-2 py-0.5 rounded-lg">
              {cashflows.length}건
            </span>
          </div>
          <div className="flex items-center gap-2">
            {cashflows.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget("cashflow"); }}
                className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            {openCf ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>
        {openCf && cashflows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  {["날짜", "구분", "금액", "계좌", "메모"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...cashflows]
                  .sort((a, b) => (b.flow_date ?? "").localeCompare(a.flow_date ?? ""))
                  .slice(0, 20)
                  .map((cf) => (
                    <tr key={cf.id} className="hover:bg-gray-50/60">
                      <td className="px-3 py-2 text-gray-600">{cf.flow_date}</td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded-md font-medium ${
                          cf.type === "WITHDRAW" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                        }`}>
                          {cf.type === "DEPOSIT" ? "입금" : cf.type === "WITHDRAW" ? "출금" : "배당"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800 tabular-nums">{formatNum(cf.amount)}</td>
                      <td className="px-3 py-2 text-gray-500">{cf.account ?? "-"}</td>
                      <td className="px-3 py-2 text-gray-400 truncate max-w-[120px]">{cf.memo ?? "-"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {cashflows.length > 20 && (
              <p className="text-center text-xs text-gray-400 py-2">
                {cashflows.length - 20}건 더 있음
              </p>
            )}
          </div>
        )}
        {openCf && cashflows.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">데이터 없음</p>
        )}
      </div>

      {/* Snapshot panel */}
      <div className="border border-gray-100 rounded-xl overflow-hidden">
        <div
          onClick={() => setOpenSnap((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">스냅샷</span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
              {snapshots.length}건
            </span>
          </div>
          <div className="flex items-center gap-2">
            {snapshots.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget("snapshot"); }}
                className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            {openSnap ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>
        {openSnap && snapshots.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50/50 border-b border-gray-100">
                <tr>
                  {["기준일", "총자산", "순투자금", "수익", "수익률"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {[...snapshots]
                  .sort((a, b) => (b.snapshot_date ?? "").localeCompare(a.snapshot_date ?? ""))
                  .slice(0, 20)
                  .map((s) => (
                    <tr key={s.id ?? s.snapshot_date} className="hover:bg-gray-50/60">
                      <td className="px-3 py-2 text-gray-600 font-medium">{s.snapshot_date}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800 tabular-nums">{formatNum(s.total_asset)}</td>
                      <td className="px-3 py-2 text-gray-500 tabular-nums">{s.net_investment != null ? formatNum(s.net_investment) : "-"}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {s.profit != null ? (
                          <span className={s.profit >= 0 ? "text-emerald-600" : "text-red-500"}>
                            {s.profit >= 0 ? "+" : ""}{formatNum(s.profit)}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-3 py-2 tabular-nums">
                        {s.return_rate != null ? (
                          <span className={s.return_rate >= 0 ? "text-emerald-600" : "text-red-500"}>
                            {s.return_rate >= 0 ? "+" : ""}{s.return_rate.toFixed(2)}%
                          </span>
                        ) : "-"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {snapshots.length > 20 && (
              <p className="text-center text-xs text-gray-400 py-2">
                {snapshots.length - 20}건 더 있음
              </p>
            )}
          </div>
        )}
        {openSnap && snapshots.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">데이터 없음</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 엑셀 업로드 섹션
// ─────────────────────────────────────────────────────────────
function ExcelUploadSection({ onDataSaved }: { onDataSaved?: () => void }) {
  const [state, setState] = useState<UploadState>("idle");
  const [fileName, setFileName] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [pendingBuffer, setPendingBuffer] = useState<ArrayBuffer | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processBuffer = useCallback((buffer: ArrayBuffer) => {
    setState("parsing");
    setErrorMsg("");
    try {
      const result = parseWorkbook(buffer);
      setParseResult(result);
      setState("preview");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "파싱 중 오류가 발생했습니다");
      setState("error");
    }
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        setErrorMsg(".xlsx 또는 .xls 파일만 업로드 가능합니다");
        setState("error");
        return;
      }
      setFileName(file.name);
      setState("parsing");
      const buffer = await file.arrayBuffer();
      const hasData = await hasInitialData();
      if (hasData) {
        setPendingBuffer(buffer);
        setShowOverwriteModal(true);
        setState("idle");
        return;
      }
      processBuffer(buffer);
    },
    [processBuffer]
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function handleOverwriteConfirm() {
    setShowOverwriteModal(false);
    await clearAllData();
    if (pendingBuffer) {
      processBuffer(pendingBuffer);
      setPendingBuffer(null);
    }
  }

  async function handleSave() {
    if (!parseResult) return;
    setState("saving");
    try {
      if (parseResult.cashflows.length > 0) await saveCashflows(parseResult.cashflows);
      if (parseResult.snapshots.length > 0) await saveSnapshots(parseResult.snapshots);
      setState("done");
      onDataSaved?.();
    } catch {
      setErrorMsg("저장 중 오류가 발생했습니다");
      setState("error");
    }
  }

  function handleReset() {
    setState("idle");
    setFileName("");
    setParseResult(null);
    setErrorMsg("");
  }

  const lastSnapshotDate =
    parseResult?.snapshots.length
      ? [...parseResult.snapshots].sort((a, b) =>
          b.snapshot_date.localeCompare(a.snapshot_date)
        )[0].snapshot_date
      : null;

  return (
    <>
      {showOverwriteModal && (
        <OverwriteModal
          onConfirm={handleOverwriteConfirm}
          onCancel={() => { setShowOverwriteModal(false); setPendingBuffer(null); setState("idle"); }}
        />
      )}

      <div className="space-y-4">
        {(state === "idle" || state === "error") && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-gray-200 rounded-xl py-10 px-6 cursor-pointer hover:border-[#5b6af4] hover:bg-indigo-50/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-[#eef0fe] flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <FileSpreadsheet className="w-6 h-6 text-[#5b6af4]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700">
                엑셀 파일 드래그 또는 클릭하여 선택
              </p>
              <p className="text-xs text-gray-400 mt-1">
                CASHFLOW, SNAPSHOT 시트가 포함된 .xlsx 파일
              </p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleInputChange} />
          </div>
        )}

        {state === "error" && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl p-3.5">
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 font-medium">{errorMsg}</p>
          </div>
        )}

        {state === "parsing" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="w-8 h-8 text-[#5b6af4] animate-spin" />
            <p className="text-sm text-gray-400">파일 분석 중...</p>
          </div>
        )}

        {state === "preview" && parseResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#5b6af4]" />
              <span className="font-medium">{fileName}</span>
            </div>
            {parseResult.errors.length > 0 && (
              <div className="space-y-1.5">
                {parseResult.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">{err}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5">
                <p className="text-xs text-gray-400 mb-1">CASHFLOW</p>
                <p className="text-lg font-bold text-gray-800">{parseResult.cashflows.length}<span className="text-xs font-normal text-gray-400 ml-1">건</span></p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5">
                <p className="text-xs text-gray-400 mb-1">SNAPSHOT</p>
                <p className="text-lg font-bold text-gray-800">{parseResult.snapshots.length}<span className="text-xs font-normal text-gray-400 ml-1">건</span></p>
                {lastSnapshotDate && <p className="text-xs text-[#5b6af4] mt-0.5">최근: {lastSnapshotDate}</p>}
              </div>
            </div>
            {parseResult.snapshots.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>{["날짜", "총자산", "순투자금", "수익률"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-400">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[...parseResult.snapshots].sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date)).slice(0, 5).map((s, i) => (
                      <tr key={i} className="hover:bg-gray-50/60">
                        <td className="px-3 py-2 text-gray-600">{s.snapshot_date}</td>
                        <td className="px-3 py-2 font-medium text-gray-800 tabular-nums">{s.total_asset.toLocaleString()}</td>
                        <td className="px-3 py-2 text-gray-500 tabular-nums">{s.net_investment != null ? s.net_investment.toLocaleString() : "-"}</td>
                        <td className="px-3 py-2 text-gray-500">{s.return_rate != null ? `${s.return_rate.toFixed(2)}%` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all">
                <Trash2 className="w-4 h-4" />취소
              </button>
              <button
                onClick={handleSave}
                disabled={parseResult.cashflows.length === 0 && parseResult.snapshots.length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#5b6af4] hover:bg-[#4a58e8] disabled:opacity-50 transition-all shadow-sm shadow-indigo-200"
              >
                <Upload className="w-4 h-4" />저장하기
              </button>
            </div>
          </div>
        )}

        {state === "saving" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="w-8 h-8 text-[#5b6af4] animate-spin" />
            <p className="text-sm text-gray-400">Supabase에 저장 중...</p>
          </div>
        )}

        {state === "done" && parseResult && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <div>
              <p className="text-base font-bold text-gray-800">저장 완료</p>
              <p className="text-xs text-gray-400 mt-1">
                CASHFLOW {parseResult.cashflows.length}건, SNAPSHOT {parseResult.snapshots.length}건
              </p>
              {lastSnapshotDate && <p className="text-xs text-[#5b6af4] mt-0.5">마지막 기준일: {lastSnapshotDate}</p>}
            </div>
            <button onClick={handleReset} className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
              다른 파일 업로드
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────────────────────
export default function InitialDataUpload({ onDataSaved }: InitialDataUploadProps) {
  const [inputTab, setInputTab] = useState<InputTab>("excel");
  const [storedCashflows, setStoredCashflows] = useState<Cashflow[]>([]);
  const [storedSnapshots, setStoredSnapshots] = useState<AssetSnapshot[]>([]);
  const [loadingStored, setLoadingStored] = useState(false);

  async function refreshStored() {
    setLoadingStored(true);
    try {
      const [cfs, snaps] = await Promise.all([getCashflows(), getSnapshots()]);
      setStoredCashflows(cfs);
      setStoredSnapshots(snaps);
    } catch (e) {
      console.error("[InitialDataUpload] refreshStored 오류:", e);
    } finally {
      setLoadingStored(false);
    }
  }

  useEffect(() => {
    refreshStored();
  }, []);

  async function handleSaved() {
    await refreshStored();
    onDataSaved?.();
  }

  async function handleClearCashflows() {
    await saveCashflows([]);
    await refreshStored();
    onDataSaved?.();
  }

  async function handleClearSnapshots() {
    await saveSnapshots([]);
    await refreshStored();
    onDataSaved?.();
  }

  return (
    <div className="space-y-5">
      {/* 입력 카드 */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        {/* 탭 헤더 */}
        <div className="flex items-center border-b border-gray-100 px-1 pt-1">
          <button
            onClick={() => setInputTab("excel")}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
              inputTab === "excel"
                ? "border-[#5b6af4] text-[#5b6af4]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            엑셀 업로드
          </button>
          <button
            onClick={() => setInputTab("manual")}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
              inputTab === "manual"
                ? "border-[#5b6af4] text-[#5b6af4]"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <PenLine className="w-4 h-4" />
            직접 입력
          </button>
        </div>

        <div className="p-5">
          {inputTab === "excel" && (
            <ExcelUploadSection onDataSaved={handleSaved} />
          )}

          {inputTab === "manual" && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-4 rounded-full bg-[#5b6af4]" />
                  <h4 className="text-sm font-bold text-gray-800">캐시플로우 입력</h4>
                  <span className="text-xs text-gray-400">(현금 입출금 기록)</span>
                </div>
                <CashflowInputForm onSaved={handleSaved} />
              </div>

              <div className="border-t border-gray-100" />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-4 rounded-full bg-emerald-500" />
                  <h4 className="text-sm font-bold text-gray-800">스냅샷 입력</h4>
                  <span className="text-xs text-gray-400">(자산 추이 기록)</span>
                </div>
                <SnapshotInputForm onSaved={handleSaved} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 저장된 데이터 현황 */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">저장된 데이터</h3>
          <p className="text-xs text-gray-400 mt-0.5">Supabase 저장 현황 · 항목 클릭으로 펼치기</p>
        </div>
        <div className="p-4">
          {loadingStored ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
            </div>
          ) : (
            <StoredDataPanel
              cashflows={storedCashflows}
              snapshots={storedSnapshots}
              onClearCashflows={handleClearCashflows}
              onClearSnapshots={handleClearSnapshots}
            />
          )}
        </div>
      </div>
    </div>
  );
}
