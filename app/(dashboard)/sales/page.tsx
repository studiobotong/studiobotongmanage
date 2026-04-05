import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Button from "@/components/Button";
import StatsCard from "@/components/StatsCard";
import { Plus, Download, Filter, TrendingUp, ShoppingCart, Package, ArrowUpRight } from "lucide-react";

const salesData = [
  { id: "#2847", product: "에코백 (네이비)", quantity: 2, amount: "54,000", status: "완료", date: "오늘 14:32" },
  { id: "#2846", product: "린넨 파우치 (아이보리)", quantity: 1, amount: "28,000", status: "완료", date: "오늘 11:15" },
  { id: "#2845", product: "캔버스 토트백", quantity: 3, amount: "114,000", status: "처리중", date: "오늘 09:50" },
  { id: "#2844", product: "면 손수건 세트", quantity: 1, amount: "18,000", status: "완료", date: "어제 18:22" },
  { id: "#2843", product: "코튼 파우치 (그레이)", quantity: 2, amount: "42,000", status: "완료", date: "어제 15:40" },
  { id: "#2842", product: "에코백 (베이지)", quantity: 1, amount: "27,000", status: "취소", date: "어제 13:05" },
  { id: "#2841", product: "린넨 파우치 (네이비)", quantity: 4, amount: "112,000", status: "완료", date: "2일 전" },
];

const statusStyle: Record<string, string> = {
  완료: "bg-emerald-50 text-emerald-600",
  처리중: "bg-blue-50 text-blue-600",
  취소: "bg-red-50 text-red-500",
};

export default function SalesPage() {
  return (
    <>
      <Header title="Sales" subtitle="판매 내역 관리" />
      <div className="px-8 py-8">
        <PageHeader
          title="판매 관리"
          description="판매 내역을 확인하고 새 판매를 입력하세요"
          actions={
            <>
              <Button variant="secondary" size="sm" icon={Download}>내보내기</Button>
              <Button variant="primary" size="sm" icon={Plus}>판매 입력</Button>
            </>
          }
        />

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatsCard title="오늘 매출" value="284,000" suffix="원" change="+12.4% 어제 대비" changeType="up" icon={TrendingUp} />
          <StatsCard title="이번 주 주문" value="47" suffix="건" change="+5건 지난주 대비" changeType="up" icon={ShoppingCart} iconColor="text-blue-500" iconBg="bg-blue-50" />
          <StatsCard title="이번 달 매출" value="3,820,000" suffix="원" change="+8.1% 지난달 대비" changeType="up" icon={ArrowUpRight} iconColor="text-emerald-500" iconBg="bg-emerald-50" />
        </div>

        {/* Table */}
        <Card padding="sm">
          <div className="flex items-center justify-between px-2 mb-4">
            <h3 className="text-sm font-semibold text-gray-700">판매 내역</h3>
            <Button variant="ghost" size="sm" icon={Filter}>필터</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">주문번호</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">상품명</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">수량</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">금액</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">상태</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">날짜</th>
                </tr>
              </thead>
              <tbody>
                {salesData.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-3.5 text-xs font-mono font-medium text-[#5b6af4]">{row.id}</td>
                    <td className="px-3 py-3.5 text-sm text-gray-700">{row.product}</td>
                    <td className="px-3 py-3.5 text-sm text-gray-500">{row.quantity}개</td>
                    <td className="px-3 py-3.5 text-sm font-semibold text-gray-800">{row.amount}원</td>
                    <td className="px-3 py-3.5">
                      <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-lg ${statusStyle[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-xs text-gray-400">{row.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-3 pt-4 mt-2 border-t border-gray-50">
            <p className="text-xs text-gray-400">총 7건 표시</p>
            <div className="flex items-center gap-1">
              <button className="px-3 py-1.5 text-xs rounded-lg border border-gray-100 text-gray-400 hover:bg-gray-50">이전</button>
              <button className="px-3 py-1.5 text-xs rounded-lg bg-[#5b6af4] text-white">1</button>
              <button className="px-3 py-1.5 text-xs rounded-lg border border-gray-100 text-gray-400 hover:bg-gray-50">다음</button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
