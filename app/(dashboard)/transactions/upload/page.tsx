"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileText } from "lucide-react";
import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import TransactionUpload from "@/components/TransactionUpload";

export default function TransactionUploadPage() {
  const router = useRouter();

  return (
    <>
      <Header title="Transactions" subtitle="거래 내역 업로드" />
      <div className="px-6 py-8 space-y-6 max-w-4xl">
        <PageHeader
          title="거래내역 일괄 업로드"
          description="엑셀 파일로 전체 거래 내역을 Supabase에 저장합니다"
          actions={
            <button
              onClick={() => router.push("/transactions")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              거래 목록
            </button>
          }
        />

        {/* How-to guide */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#5b6af4]" />
            <h3 className="text-sm font-semibold text-gray-800">파일 형식 안내</h3>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">필수 컬럼</p>
                <div className="flex flex-wrap gap-1.5">
                  {["거래일", "거래유형", "종목명", "티커", "시장", "통화", "수량", "단가"].map((c) => (
                    <span
                      key={c}
                      className="text-xs font-medium text-[#5b6af4] bg-[#eef0fe] px-2.5 py-1 rounded-lg"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">선택 컬럼</p>
                <div className="flex flex-wrap gap-1.5">
                  {["수수료", "메모"].map((c) => (
                    <span
                      key={c}
                      className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-500 space-y-1">
              <p>• <strong>거래유형</strong>: BUY (매수) 또는 SELL (매도)</p>
              <p>• <strong>거래일</strong>: YYYY-MM-DD 또는 YYYY/MM/DD 형식</p>
              <p>• <strong>중복 방지</strong>: 거래일+유형+티커+수량+단가 조합이 동일하면 스킵됩니다</p>
            </div>
          </div>
        </div>

        {/* Upload component */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl bg-[#eef0fe] flex items-center justify-center">
              <Upload className="w-4 h-4 text-[#5b6af4]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">파일 업로드</p>
              <p className="text-xs text-gray-400">xlsx, xls, csv 지원</p>
            </div>
          </div>
          <TransactionUpload
            onComplete={(inserted, skipped) => {
              setTimeout(() => router.push("/transactions"), 1500);
            }}
          />
        </div>
      </div>
    </>
  );
}
