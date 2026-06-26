import { Suspense } from "react";
import SettlementUploadClient from "@/components/settlements/SettlementUploadClient";

export default function SettlementsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24 text-gray-400 text-sm">로딩 중…</div>}>
      <SettlementUploadClient />
    </Suspense>
  );
}
