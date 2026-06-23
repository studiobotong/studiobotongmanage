import { Suspense } from "react";
import Header from "@/components/Header";
import StatsPageClient from "@/components/dashboard/StatsPageClient";

export default function StatsPage() {
  return (
    <>
      <Header title="Analytics" subtitle="통계 및 분석" />
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
            로딩 중…
          </div>
        }
      >
        <StatsPageClient />
      </Suspense>
    </>
  );
}
