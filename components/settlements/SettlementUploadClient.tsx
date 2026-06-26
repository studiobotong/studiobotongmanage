"use client";

import { useCallback, useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import Header from "@/components/Header";
import Button from "@/components/Button";
import Card from "@/components/Card";

interface SettlementUploadResult {
  upserted: number;
  skipped: number;
  totalRows: number;
  elapsedMs: number;
  month: string;
  errors: string[];
  parseWarnings?: string[];
}

type UploadState = "idle" | "uploading" | "done" | "error";

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}초`;
}

export default function SettlementUploadClient() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState<UploadState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<SettlementUploadResult | null>(null);

  const resetResult = () => {
    setResult(null);
    setErrorMsg("");
    setState("idle");
  };

  const handleFile = useCallback((next: File | null) => {
    if (!next) return;
    if (!next.name.toLowerCase().endsWith(".xlsx")) {
      setErrorMsg(".xlsx 파일만 업로드할 수 있습니다.");
      setState("error");
      return;
    }
    setFile(next);
    resetResult();
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files?.[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile]
  );

  const handleUpload = async () => {
    if (!file) {
      setErrorMsg("업로드할 파일을 선택해주세요.");
      setState("error");
      return;
    }

    setState("uploading");
    setErrorMsg("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/settlements/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setErrorMsg(json.error ?? "업로드에 실패했습니다.");
        setState("error");
        return;
      }

      setResult(json.result as SettlementUploadResult);
      setState("done");
    } catch (e) {
      setErrorMsg(
        e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다."
      );
      setState("error");
    }
  };

  return (
    <>
      <Header title="정산내역 업로드" subtitle="SellerDailySettle 월별 정산 파일" />
      <div className="px-8 py-8">
        <div className="mb-6">
          <h2 className="text-base font-semibold text-gray-800">정산내역 업로드</h2>
          <p className="mt-1 text-sm text-gray-500">
            네이버 스마트스토어 &lsquo;SellerDailySettle&rsquo; 파일을 월별로 업로드하세요.
            중복 날짜는 자동으로 덮어씁니다.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={clsx(
                "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 transition-colors",
                dragOver
                  ? "border-[#5b6af4] bg-[#eef0fe]"
                  : "border-gray-200 hover:border-[#5b6af4]/40 hover:bg-gray-50"
              )}
            >
              {file ? (
                <>
                  <FileSpreadsheet className="mb-3 h-10 w-10 text-[#5b6af4]" />
                  <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </>
              ) : (
                <>
                  <Upload className="mb-3 h-10 w-10 text-gray-300" />
                  <p className="text-sm font-medium text-gray-600">
                    파일을 드래그하거나 클릭하여 선택
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    SellerDailySettle_YYYYMM.xlsx
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />

            <div className="mt-5 flex gap-2">
              <Button
                variant="primary"
                fullWidth
                disabled={!file || state === "uploading"}
                onClick={handleUpload}
                icon={state === "uploading" ? Loader2 : Upload}
                className={state === "uploading" ? "[&_svg]:animate-spin" : ""}
              >
                {state === "uploading" ? "업로드 중..." : "업로드 시작"}
              </Button>
              {file && state !== "uploading" && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setFile(null);
                    resetResult();
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  초기화
                </Button>
              )}
            </div>
          </Card>

          <Card>
            <h3 className="mb-4 text-sm font-semibold text-gray-700">업로드 결과</h3>

            {state === "idle" && !result && (
              <p className="text-sm text-gray-400">
                파일을 선택하고 업로드를 시작하면 결과가 여기에 표시됩니다.
              </p>
            )}

            {state === "uploading" && (
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin text-[#5b6af4]" />
                정산 데이터를 처리하는 중...
              </div>
            )}

            {state === "error" && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {state === "done" && result && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  업로드 완료 {result.month && `— ${result.month}`}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-50 px-4 py-3">
                    <p className="text-xs text-emerald-600">저장/업데이트</p>
                    <p className="text-2xl font-bold text-emerald-700">
                      {result.upserted}
                      <span className="ml-1 text-sm font-medium">건</span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-4 py-3">
                    <p className="text-xs text-gray-500">처리</p>
                    <p className="text-lg font-bold text-gray-700">
                      {result.totalRows}행 / {formatMs(result.elapsedMs)}
                    </p>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
                    <p className="mb-1 font-semibold">일부 오류</p>
                    <ul className="list-inside list-disc space-y-0.5">
                      {result.errors.map((err) => (
                        <li key={err}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.parseWarnings && result.parseWarnings.length > 0 && (
                  <div className="text-xs text-gray-400">
                    {result.parseWarnings.join(" / ")}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
