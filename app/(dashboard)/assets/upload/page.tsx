"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import InitialDataUpload from "@/components/InitialDataUpload";

export default function AssetsUploadPage() {
  return (
    <>
      <Header title="초기자료 업로드" subtitle="CASHFLOW · SNAPSHOT 엑셀" />

      <div className="px-6 py-6 space-y-4">
        <Link
          href="/assets"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-[#5b6af4] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Asset 대시보드로
        </Link>

        <div className="max-w-2xl">
          <InitialDataUpload
            onDataSaved={() => {
              window.location.href = "/assets";
            }}
          />
        </div>
      </div>
    </>
  );
}
