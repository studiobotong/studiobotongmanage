import clsx from "clsx";
import type { MarketingCampaignRow } from "@/types/adReports";

function formatKrw(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function formatPct(n: number | null): string {
  if (n == null) return "—";
  return `${n.toFixed(1)}%`;
}

const PLATFORM_LABEL: Record<string, string> = {
  meta: "메타",
  naver: "네이버",
};

interface MarketingCampaignTableProps {
  campaigns: MarketingCampaignRow[];
}

export default function MarketingCampaignTable({
  campaigns,
}: MarketingCampaignTableProps) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
      <div className="px-5 sm:px-6 py-4 border-b border-[#E5E7EB]">
        <h3 className="text-sm font-semibold text-gray-700">
          캠페인별 성과
        </h3>
      </div>
      {campaigns.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">
          광고 데이터가 없습니다. 데이터를 입력해주세요.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-50">
                <th className="text-left font-medium px-5 py-3">캠페인명</th>
                <th className="text-left font-medium px-3 py-3">플랫폼</th>
                <th className="text-right font-medium px-3 py-3">광고비</th>
                <th className="text-right font-medium px-3 py-3">매출기여</th>
                <th className="text-right font-medium px-3 py-3">ROAS</th>
                <th className="text-right font-medium px-3 py-3">CPA</th>
                <th className="text-right font-medium px-5 py-3">CTR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {campaigns.map((c, i) => (
                <tr key={`${c.campaignName}-${c.platform}-${i}`}>
                  <td className="px-5 py-3 font-medium text-gray-800 max-w-[200px] truncate">
                    {c.campaignName}
                  </td>
                  <td className="px-3 py-3 text-gray-500">
                    {PLATFORM_LABEL[c.platform] ?? c.platform}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                    {formatKrw(c.spend)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                    {formatKrw(c.revenue)}
                  </td>
                  <td
                    className={clsx(
                      "px-3 py-3 text-right tabular-nums font-medium",
                      c.roas != null && c.roas >= 300 && "text-emerald-600",
                      c.roas != null && c.roas < 100 && "text-red-500",
                      c.roas != null && c.roas >= 100 && c.roas < 300 && "text-gray-700"
                    )}
                  >
                    {formatPct(c.roas)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                    {c.cpa != null ? formatKrw(c.cpa) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-700">
                    {formatPct(c.ctr)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
