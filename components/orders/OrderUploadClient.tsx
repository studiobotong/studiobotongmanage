"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  XCircle,
  Lock,
  ArrowLeft,
} from "lucide-react";
import clsx from "clsx";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import Card from "@/components/Card";
import type { OrderUploadResult } from "@/types/orders";

type UploadState = "idle" | "uploading" | "done" | "error";

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}초`;
}

export default function OrderUploadClient() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [applyStock, setApplyStock] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState<UploadState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<OrderUploadResult | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);

  const resetResult = () => {
    setResult(null);
    setParseWarnings([]);
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
      formData.append("password", password);
      formData.append("applyStock", applyStock ? "true" : "false");

      const res = await fetch("/api/orders/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setErrorMsg(json.error ?? "업로드에 실패했습니다.");
        setState("error");
        return;
      }

      setResult(json.result as OrderUploadResult);
      setParseWarnings(json.result?.parseWarnings ?? []);
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
      <Header title="주문 업로드" subtitle="스마트스토어 주문 엑셀" />
      <div className="px-8 py-8">
        <PageHeader
          title="주문 엑셀 업로드"
          description="스마트스토어 '전체주문발주발송관리' 또는 '구매확정내역' 엑셀을 업로드합니다"
          actions={
            <Link href="/orders">
              <Button variant="secondary" size="sm" icon={ArrowLeft}>
                주문 목록
              </Button>
            </Link>
          }
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
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
                    발주발송관리 · 구매확정내역 시트가 포함된 .xlsx
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

            <div className="mt-5">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <Lock className="h-3.5 w-3.5" />
                엑셀 비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="다운로드 시 설정한 비밀번호"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[#5b6af4] focus:ring-2 focus:ring-[#5b6af4]/20"
              />
              <p className="mt-1.5 text-xs text-gray-400">
                네이버 스마트스토어에서 비밀번호 보호 옵션으로 다운로드한 파일은
                비밀번호가 필요합니다.
              </p>
            </div>

            <div className="mt-5">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-gray-200 px-3 py-2.5 hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={applyStock}
                  onChange={(e) => setApplyStock(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#5b6af4] focus:ring-[#5b6af4]/20"
                />
                <span className="text-sm text-gray-700">
                  이 업로드로 재고를 차감하시겠습니까?
                  <span className="mt-0.5 block text-xs text-gray-400">
                    과거 이력 엑셀처럼 이미 처리된 주문을 업로드할 때는 체크를
                    해제하세요. 재고가 중복으로 차감되는 것을 막을 수 있습니다.
                  </span>
                </span>
              </label>
            </div>

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
                엑셀 복호화 및 주문 데이터를 처리하는 중...
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
                  업로드 완료
                </div>

                <div className="rounded-xl bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
                  재고 반영:{" "}
                  <span className="font-semibold text-gray-800">
                    {result.stockApplied ? "적용함" : "적용 안 함"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-50 px-4 py-3">
                    <p className="text-xs text-emerald-600">신규 저장</p>
                    <p className="text-2xl font-bold text-emerald-700">
                      {result.inserted}
                      <span className="ml-1 text-sm font-medium">건</span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-4 py-3">
                    <p className="text-xs text-gray-500">중복 스킵</p>
                    <p className="text-2xl font-bold text-gray-700">
                      {result.skipped}
                      <span className="ml-1 text-sm font-medium">건</span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-50 px-4 py-3">
                    <p className="text-xs text-amber-600">미매칭 상품</p>
                    <p className="text-2xl font-bold text-amber-700">
                      {result.unmatched}
                      <span className="ml-1 text-sm font-medium">건</span>
                    </p>
                  </div>
                  <div className="rounded-xl bg-blue-50 px-4 py-3">
                    <p className="text-xs text-blue-600">처리</p>
                    <p className="text-lg font-bold text-blue-700">
                      {result.totalRows}행 / {formatMs(result.elapsedMs)}
                    </p>
                  </div>
                </div>

                {result.unmatchedProducts.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold text-gray-600">
                      미매칭 상품 목록
                    </p>
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-50 bg-gray-50/80">
                            <th className="px-3 py-2 text-left font-medium text-gray-500">
                              상품명
                            </th>
                            <th className="px-3 py-2 text-left font-medium text-gray-500">
                              옵션
                            </th>
                            <th className="px-3 py-2 text-right font-medium text-gray-500">
                              건수
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.unmatchedProducts.map((item) => (
                            <tr
                              key={`${item.product_name}-${item.option_name}`}
                              className="border-b border-gray-50"
                            >
                              <td className="px-3 py-2 text-gray-700">
                                {item.product_name}
                              </td>
                              <td className="px-3 py-2 text-gray-500">
                                {item.option_name || "—"}
                              </td>
                              <td className="px-3 py-2 text-right text-gray-600">
                                {item.count}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      미매칭 상품은{" "}
                      <Link href="/products" className="text-[#5b6af4] hover:underline">
                        상품 관리
                      </Link>
                      에서 등록 후 다시 업로드하세요.
                    </p>
                  </div>
                )}

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

                {parseWarnings.length > 0 && (
                  <div className="text-xs text-gray-400">
                    {parseWarnings.join(" / ")}
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
