"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  ArrowUpFromLine,
  Info,
} from "lucide-react";
import clsx from "clsx";
import type { UploadRow } from "@/types/transactions";
import { bulkInsertTransactions } from "@/lib/transactions";

// ---------------------------------------------------------------------------
// Column mapping (Korean → internal key)
// ---------------------------------------------------------------------------

const COL_MAP: Record<string, string> = {
  거래일: "trade_date",
  거래유형: "type",
  종목명: "name",
  티커: "symbol",
  시장: "market",
  통화: "currency",
  수량: "quantity",
  단가: "unit_price",
  수수료: "fee",
  메모: "memo",
};

const REQUIRED_COLS = ["거래일", "거래유형", "종목명", "티커", "시장", "통화", "수량", "단가"];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function normalizeHeader(h: string): string {
  return h.trim().replace(/\s+/g, "");
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[./]/g, "-");
  const d = new Date(cleaned);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

function toNum(v: string | number | undefined): number {
  if (v === undefined || v === "") return 0;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

function validateRow(row: UploadRow): string | null {
  if (!row.trade_date) return "거래일 형식 오류";
  const t = String(row.type || "").toUpperCase().trim();
  if (t !== "BUY" && t !== "SELL") return "거래유형은 BUY 또는 SELL이어야 합니다";
  if (!row.name?.toString().trim()) return "종목명 없음";
  if (!row.symbol?.toString().trim()) return "티커 없음";
  if (!row.market?.toString().trim()) return "시장 없음";
  if (!row.currency?.toString().trim()) return "통화 없음";
  const qty = toNum(row.quantity);
  if (qty <= 0) return "수량은 0보다 커야 합니다";
  const price = toNum(row.unit_price);
  if (price <= 0) return "단가는 0보다 커야 합니다";
  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface TransactionUploadProps {
  onComplete?: (inserted: number, skipped: number) => void;
}

export default function TransactionUpload({ onComplete }: TransactionUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [missingCols, setMissingCols] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = useCallback(async (file: File) => {
    setResult(null);
    setApiError(null);
    setMissingCols([]);

    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    if (raw.length < 2) {
      setRows([]);
      setFileName(file.name);
      return;
    }

    const headers = (raw[0] as string[]).map(normalizeHeader);

    // Check required columns
    const missing = REQUIRED_COLS.filter(
      (req) => !headers.includes(normalizeHeader(req))
    );
    setMissingCols(missing);

    const dataRows = raw.slice(1) as (string | number)[][];

    const parsed: UploadRow[] = dataRows
      .filter((row) => row.some((c) => c !== "" && c !== null && c !== undefined))
      .map((row, idx) => {
        const obj: Record<string, string | number> = {};
        headers.forEach((h, i) => {
          const key = COL_MAP[h] ?? h;
          obj[key] = row[i] ?? "";
        });

        const rawDate = obj.trade_date;
        const dateStr =
          rawDate !== null &&
          typeof rawDate === "object" &&
          "toISOString" in (rawDate as object)
            ? (rawDate as unknown as Date).toISOString()
            : parseDate(String(rawDate)) ?? "";

        const uploadRow: UploadRow = {
          rowIndex: idx + 2,
          trade_date: dateStr,
          type: String(obj.type || "").toUpperCase().trim(),
          name: String(obj.name || "").trim(),
          symbol: String(obj.symbol || "").trim().toUpperCase(),
          market: String(obj.market || "").trim().toUpperCase(),
          currency: String(obj.currency || "").trim().toUpperCase(),
          quantity: obj.quantity,
          unit_price: obj.unit_price,
          fee: obj.fee,
          memo: String(obj.memo || "").trim(),
        };

        const err = missing.length === 0 ? validateRow(uploadRow) : null;
        if (err) uploadRow.error = err;

        return uploadRow;
      });

    setRows(parsed);
    setFileName(file.name);
  }, []);

  function handleFile(file: File) {
    parseFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  async function handleUpload() {
    const validRows = rows.filter((r) => !r.error && !r.isDuplicate);
    if (validRows.length === 0) return;

    setUploading(true);
    setApiError(null);

    try {
      const toInsert = validRows.map((r) => ({
        trade_date: r.trade_date,
        type: r.type as "BUY" | "SELL",
        name: r.name,
        symbol: r.symbol,
        market: r.market,
        currency: r.currency,
        quantity: toNum(r.quantity),
        unit_price: toNum(r.unit_price),
        total_amount: toNum(r.quantity) * toNum(r.unit_price),
        fee: r.fee ? toNum(r.fee) : null,
        memo: r.memo || null,
      }));

      const res = await bulkInsertTransactions(toInsert);
      setResult(res);
      onComplete?.(res.inserted, res.skipped);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setRows([]);
    setFileName("");
    setMissingCols([]);
    setResult(null);
    setApiError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const validCount = rows.filter((r) => !r.error).length;
  const errorCount = rows.filter((r) => r.error).length;

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      {rows.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={clsx(
            "border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all",
            dragOver
              ? "border-[#5b6af4] bg-[#eef0fe]"
              : "border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50"
          )}
        >
          <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
            <FileSpreadsheet className="w-7 h-7 text-[#5b6af4]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">
              엑셀 파일을 여기에 드래그하거나 클릭하여 선택
            </p>
            <p className="text-xs text-gray-400 mt-1">.xlsx 또는 .csv 파일 지원</p>
          </div>
          <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 max-w-sm">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>
              필수 컬럼: <strong>거래일, 거래유형, 종목명, 티커, 시장, 통화, 수량, 단가</strong>
            </span>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      )}

      {/* Missing columns error */}
      {missingCols.length > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">필수 컬럼 누락</p>
            <p className="text-xs text-red-500 mt-1">
              다음 컬럼이 없습니다:{" "}
              <strong>{missingCols.join(", ")}</strong>
            </p>
          </div>
        </div>
      )}

      {/* File info + stats */}
      {rows.length > 0 && (
        <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-3.5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#eef0fe] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-[#5b6af4]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{fileName}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                총 {rows.length}행 ·{" "}
                <span className="text-emerald-600 font-medium">{validCount}개 유효</span>
                {errorCount > 0 && (
                  <span className="text-red-500 font-medium"> · {errorCount}개 오류</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={reset}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && missingCols.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">미리보기</h3>
            <span className="text-xs text-gray-400">최대 50행 표시</span>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-gray-500 font-semibold">행</th>
                  <th className="px-4 py-2.5 text-left text-gray-500 font-semibold">거래일</th>
                  <th className="px-4 py-2.5 text-left text-gray-500 font-semibold">유형</th>
                  <th className="px-4 py-2.5 text-left text-gray-500 font-semibold">종목명</th>
                  <th className="px-4 py-2.5 text-left text-gray-500 font-semibold">티커</th>
                  <th className="px-4 py-2.5 text-left text-gray-500 font-semibold">시장</th>
                  <th className="px-4 py-2.5 text-right text-gray-500 font-semibold">수량</th>
                  <th className="px-4 py-2.5 text-right text-gray-500 font-semibold">단가</th>
                  <th className="px-4 py-2.5 text-right text-gray-500 font-semibold">수수료</th>
                  <th className="px-4 py-2.5 text-left text-gray-500 font-semibold">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.slice(0, 50).map((r) => (
                  <tr
                    key={r.rowIndex}
                    className={clsx(
                      "transition-colors",
                      r.error
                        ? "bg-red-50/60"
                        : r.isDuplicate
                        ? "bg-amber-50/60"
                        : "hover:bg-gray-50/60"
                    )}
                  >
                    <td className="px-4 py-2 text-gray-400 font-mono">{r.rowIndex}</td>
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                      {r.trade_date ? new Date(r.trade_date).toLocaleDateString("ko-KR") : "-"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          "px-1.5 py-0.5 rounded-md text-[10px] font-bold",
                          r.type === "BUY"
                            ? "bg-emerald-100 text-emerald-700"
                            : r.type === "SELL"
                            ? "bg-red-100 text-red-600"
                            : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {r.type || "?"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-800 font-medium">{r.name}</td>
                    <td className="px-4 py-2 font-mono text-gray-500">{r.symbol}</td>
                    <td className="px-4 py-2 text-gray-500">{r.market}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                      {toNum(r.quantity).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                      {toNum(r.unit_price).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-500">
                      {r.fee ? toNum(r.fee).toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {r.error ? (
                        <span className="text-red-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {r.error}
                        </span>
                      ) : r.isDuplicate ? (
                        <span className="text-amber-500">중복</span>
                      ) : (
                        <span className="text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          정상
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload result */}
      {result && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-700">업로드 완료</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              {result.inserted}건 저장 · {result.skipped}건 중복 스킵
            </p>
          </div>
        </div>
      )}

      {/* API error */}
      {apiError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-5 py-4">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">{apiError}</p>
        </div>
      )}

      {/* Upload button */}
      {rows.length > 0 && missingCols.length === 0 && validCount > 0 && !result && (
        <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {validCount}건을 Supabase에 업로드하시겠습니까?
            </p>
            {errorCount > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">
                오류 {errorCount}건은 제외됩니다
              </p>
            )}
          </div>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#5b6af4] hover:bg-[#4a58e8] disabled:opacity-60 transition-all shadow-sm shadow-indigo-200"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUpFromLine className="w-4 h-4" />
            )}
            {uploading ? "업로드 중..." : "업로드 실행"}
          </button>
        </div>
      )}
    </div>
  );
}
