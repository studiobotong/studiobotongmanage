import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import StatsCard from "@/components/StatsCard";
import { TrendingUp, ShoppingCart, Package, Users, BarChart3 } from "lucide-react";

const monthlySales = [
  { month: "10월", value: 2840000, percent: 74 },
  { month: "11월", value: 3120000, percent: 82 },
  { month: "12월", value: 3820000, percent: 100 },
  { month: "1월", value: 2100000, percent: 55 },
  { month: "2월", value: 2560000, percent: 67 },
  { month: "3월", value: 3040000, percent: 80 },
];

const topProducts = [
  { name: "캔버스 토트백", sales: 87, revenue: "3,306,000", percent: 100 },
  { name: "린넨 파우치 (아이보리)", sales: 64, revenue: "1,792,000", percent: 74 },
  { name: "에코백 (네이비)", sales: 58, revenue: "1,566,000", percent: 67 },
  { name: "코튼 파우치 (그레이)", sales: 41, revenue: "861,000", percent: 47 },
  { name: "면 손수건 세트", sales: 29, revenue: "522,000", percent: 33 },
];

export default function StatsPage() {
  return (
    <>
      <Header title="Analytics" subtitle="통계 및 분석" />
      <div className="px-8 py-8">
        <PageHeader
          title="통계 분석"
          description="판매 현황과 성과 지표를 한눈에 확인하세요"
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <StatsCard title="이번 달 매출" value="3,820,000" suffix="원" change="+8.1% 전월 대비" changeType="up" icon={TrendingUp} />
          <StatsCard title="총 주문 수" value="279" suffix="건" change="+12.3% 전월 대비" changeType="up" icon={ShoppingCart} iconColor="text-blue-500" iconBg="bg-blue-50" />
          <StatsCard title="판매 상품 수" value="8" suffix="종" change="신규 1종 추가" changeType="up" icon={Package} iconColor="text-purple-500" iconBg="bg-purple-50" />
          <StatsCard title="평균 주문 금액" value="31,200" suffix="원" change="+2.4% 전월 대비" changeType="up" icon={Users} iconColor="text-emerald-500" iconBg="bg-emerald-50" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Sales Chart */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">월별 매출 추이</h3>
                <p className="text-xs text-gray-400 mt-0.5">최근 6개월</p>
              </div>
              <BarChart3 className="w-4 h-4 text-gray-300" />
            </div>
            <div className="flex items-end gap-3 h-44">
              {monthlySales.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-medium">
                    {(m.value / 10000).toFixed(0)}만
                  </span>
                  <div className="w-full flex flex-col justify-end" style={{ height: "120px" }}>
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-[#5b6af4] to-[#818cf8] transition-all"
                      style={{ height: `${m.percent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400">{m.month}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Top Products */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">인기 상품 Top 5</h3>
                <p className="text-xs text-gray-400 mt-0.5">이번 달 기준</p>
              </div>
            </div>
            <div className="space-y-4">
              {topProducts.map((product, idx) => (
                <div key={product.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-300 w-4">{idx + 1}</span>
                      <span className="text-sm text-gray-700">{product.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-gray-800">{product.sales}건</span>
                      <span className="text-xs text-gray-400 ml-2">{product.revenue}원</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-50 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#5b6af4] to-[#818cf8]"
                      style={{ width: `${product.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Sales by Category */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-800 mb-6">카테고리별 매출 비중</h3>
            <div className="flex items-center gap-8">
              <div className="relative w-32 h-32 flex-shrink-0">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#eef0fe" strokeWidth="16" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#5b6af4" strokeWidth="16"
                    strokeDasharray="188 126" strokeLinecap="round" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#818cf8" strokeWidth="16"
                    strokeDasharray="75 239" strokeDashoffset="-188" strokeLinecap="round" />
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#c7d2fe" strokeWidth="16"
                    strokeDasharray="51 263" strokeDashoffset="-263" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-gray-600">3종</span>
                </div>
              </div>
              <div className="space-y-3 flex-1">
                {[
                  { cat: "가방", percent: 59, color: "bg-[#5b6af4]" },
                  { cat: "파우치", percent: 24, color: "bg-[#818cf8]" },
                  { cat: "소품", percent: 16, color: "bg-[#c7d2fe]" },
                ].map((item) => (
                  <div key={item.cat} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                      <span className="text-sm text-gray-600">{item.cat}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-800">{item.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Placeholder: Trend */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-800 mb-2">주간 판매 추이</h3>
            <p className="text-xs text-gray-400 mb-6">이번 주 일별 판매량</p>
            <div className="flex items-end gap-2 h-32">
              {[
                { day: "월", val: 65 },
                { day: "화", val: 40 },
                { day: "수", val: 80 },
                { day: "목", val: 55 },
                { day: "금", val: 90 },
                { day: "토", val: 100 },
                { day: "일", val: 70 },
              ].map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex flex-col justify-end" style={{ height: "88px" }}>
                    <div
                      className="w-full rounded-t-md bg-[#eef0fe] hover:bg-[#5b6af4] transition-colors cursor-pointer"
                      style={{ height: `${d.val}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-400">{d.day}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
