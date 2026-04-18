import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import AssetPageClient from "./AssetPageClient";

function AssetPageFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
      <Loader2 className="w-8 h-8 text-[#5b6af4] animate-spin" />
      <p className="text-sm text-gray-400">로딩 중...</p>
    </div>
  );
}

export default function AssetsPage() {
  return (
    <Suspense fallback={<AssetPageFallback />}>
      <AssetPageClient />
    </Suspense>
  );
}
