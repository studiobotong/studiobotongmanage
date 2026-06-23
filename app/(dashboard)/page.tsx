import { Suspense } from "react";
import DashboardPageClient from "@/components/dashboard/DashboardPageClient";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
          로딩 중…
        </div>
      }
    >
      <DashboardPageClient />
    </Suspense>
  );
}
