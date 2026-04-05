import Header from "@/components/Header";
import StatsCard from "@/components/StatsCard";
import Card from "@/components/Card";
import Button from "@/components/Button";
import {
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  DollarSign,
  Plus,
  Package,
  Edit3,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Box,
} from "lucide-react";
import Link from "next/link";

const recentActivities = [
  {
    id: 1,
    type: "sale",
    message: "새 주문이 접수되었습니다",
    detail: "주문번호 #2847 · 에코백 2개",
    time: "방금 전",
    icon: ShoppingCart,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-500",
  },
  {
    id: 2,
    type: "inventory",
    message: "재고 부족 알림",
    detail: "린넨 파우치 · 잔여 3개",
    time: "12분 전",
    icon: AlertTriangle,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
  },
  {
    id: 3,
    type: "product",
    message: "상품 정보가 업데이트되었습니다",
    detail: "캔버스 토트백 · 가격 수정",
    time: "1시간 전",
    icon: Edit3,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-500",
  },
  {
    id: 4,
    type: "sale",
    message: "주문이 완료 처리되었습니다",
    detail: "주문번호 #2846 · 총 38,000원",
    time: "2시간 전",
    icon: CheckCircle2,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-500",
  },
  {
    id: 5,
    type: "inventory",
    message: "재고가 입고되었습니다",
    detail: "면 파우치 50개 추가",
    time: "어제",
    icon: Box,
    iconBg: "bg-gray-50",
    iconColor: "text-gray-500",
  },
];

const quickActions = [
  {
    label: "판매 입력",
    description: "새 판매 내역 추가",
    href: "/sales",
    icon: Plus,
    color: "bg-[#5b6af4] text-white hover:bg-[#4a58e8]",
    iconBg: "bg-white/20",
  },
  {
    label: "재고 관리",
    description: "재고 현황 확인",
    href: "/inventory",
    icon: Package,
    color: "bg-white text-gray-700 hover:bg-gray-50 border border-gray-100",
    iconBg: "bg-[#eef0fe]",
    iconColor: "text-[#5b6af4]",
  },
  {
    label: "상품 수정",
    description: "상품 정보 편집",
    href: "/products",
    icon: Edit3,
    color: "bg-white text-gray-700 hover:bg-gray-50 border border-gray-100",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-500",
  },
];

export default function DashboardPage() {
  return (
    <>
      <Header title="Dashboard" subtitle="스튜디오 보통 운영 현황" />

      <div className="px-8 py-8">
        {/* Welcome Banner */}
        <div className="mb-8 bg-gradient-to-br from-[#5b6af4] to-[#818cf8] rounded-2xl p-6 text-white shadow-lg shadow-indigo-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-indigo-100 text-sm font-medium">안녕하세요 👋</p>
              <h2 className="text-2xl font-bold mt-1">오늘도 좋은 하루 되세요</h2>
              <p className="text-indigo-200 text-sm mt-2">
                오늘 매출은 전날 대비 <strong className="text-white">12.4%</strong> 상승했어요
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-white/80 text-sm">
              <Clock className="w-4 h-4" />
              <span>실시간 업데이트 중</span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <StatsCard
            title="오늘 매출"
            value="284,000"
            suffix="원"
            change="어제보다 +12.4%"
            changeType="up"
            icon={TrendingUp}
            iconColor="text-[#5b6af4]"
            iconBg="bg-[#eef0fe]"
          />
          <StatsCard
            title="총 주문 수"
            value="23"
            suffix="건"
            change="이번 주 +5건"
            changeType="up"
            icon={ShoppingCart}
            iconColor="text-blue-500"
            iconBg="bg-blue-50"
          />
          <StatsCard
            title="재고 부족 상품"
            value="4"
            suffix="개"
            change="즉시 확인 필요"
            changeType="down"
            icon={AlertTriangle}
            iconColor="text-amber-500"
            iconBg="bg-amber-50"
          />
          <StatsCard
            title="이번 달 총 매출"
            value="3,820,000"
            suffix="원"
            change="지난달 대비 +8.1%"
            changeType="up"
            icon={DollarSign}
            iconColor="text-emerald-500"
            iconBg="bg-emerald-50"
          />
        </div>

        {/* Quick Actions + Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">빠른 액션</h3>
            </div>
            <div className="space-y-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={`flex items-center gap-4 p-4 rounded-2xl shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 ${action.color}`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${action.iconBg}`}
                    >
                      <Icon
                        className={`w-4 h-4 ${
                          action.iconColor
                            ? action.iconColor
                            : "text-white"
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{action.label}</p>
                      <p
                        className={`text-xs mt-0.5 ${
                          action.label === "판매 입력"
                            ? "text-indigo-200"
                            : "text-gray-400"
                        }`}
                      >
                        {action.description}
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 ml-auto opacity-60 flex-shrink-0" />
                  </Link>
                );
              })}
            </div>

            {/* Today Summary */}
            <Card className="mt-4" padding="sm">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                오늘 요약
              </h4>
              <div className="space-y-3">
                {[
                  { label: "처리 완료 주문", value: "18건" },
                  { label: "대기 중 주문", value: "5건" },
                  { label: "신규 상품 등록", value: "0개" },
                  { label: "재고 조정", value: "2건" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{item.label}</span>
                    <span className="text-xs font-semibold text-gray-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">최근 활동</h3>
              <Button variant="ghost" size="sm">
                전체 보기
              </Button>
            </div>
            <Card padding="sm">
              <ul className="divide-y divide-gray-50">
                {recentActivities.map((activity) => {
                  const Icon = activity.icon;
                  return (
                    <li
                      key={activity.id}
                      className="flex items-start gap-4 py-3.5 first:pt-1 last:pb-1 hover:bg-gray-50/50 -mx-2 px-2 rounded-xl transition-colors cursor-pointer"
                    >
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${activity.iconBg}`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${activity.iconColor}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800">
                          {activity.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{activity.detail}</p>
                      </div>
                      <span className="text-[10px] text-gray-300 whitespace-nowrap mt-0.5 flex-shrink-0">
                        {activity.time}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
