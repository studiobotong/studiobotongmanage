import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Button from "@/components/Button";
import { User, Store, Bell, Shield, Palette, ChevronRight } from "lucide-react";

const settingsSections = [
  {
    id: "profile",
    icon: User,
    iconBg: "bg-[#eef0fe]",
    iconColor: "text-[#5b6af4]",
    title: "프로필",
    description: "관리자 계정 정보 및 비밀번호 변경",
  },
  {
    id: "store",
    icon: Store,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-500",
    title: "스토어 정보",
    description: "스튜디오 보통 기본 정보 및 연락처 설정",
  },
  {
    id: "notifications",
    icon: Bell,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
    title: "알림 설정",
    description: "재고 부족, 주문 알림 등 알림 환경설정",
  },
  {
    id: "security",
    icon: Shield,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    title: "보안",
    description: "2단계 인증 및 로그인 기록 관리",
  },
  {
    id: "appearance",
    icon: Palette,
    iconBg: "bg-purple-50",
    iconColor: "text-purple-500",
    title: "화면 설정",
    description: "테마 및 언어, 시간대 설정",
  },
];

export default function SettingsPage() {
  return (
    <>
      <Header title="Settings" subtitle="환경 설정" />
      <div className="px-8 py-8">
        <PageHeader
          title="설정"
          description="관리자 계정 및 시스템 환경을 설정하세요"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings Menu */}
          <div className="lg:col-span-1">
            <Card padding="sm">
              <nav className="space-y-1">
                {settingsSections.map((section, idx) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left ${
                        idx === 0
                          ? "bg-[#eef0fe] text-[#5b6af4]"
                          : "hover:bg-gray-50 text-gray-600"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${section.iconBg}`}>
                        <Icon className={`w-4 h-4 ${section.iconColor}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${idx === 0 ? "text-[#5b6af4]" : "text-gray-700"}`}>
                          {section.title}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{section.description}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    </button>
                  );
                })}
              </nav>
            </Card>
          </div>

          {/* Settings Content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Profile Section */}
            <Card>
              <h3 className="text-sm font-semibold text-gray-800 mb-6">프로필 정보</h3>
              <div className="flex items-center gap-5 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#5b6af4] to-[#818cf8] flex items-center justify-center text-white text-2xl font-bold">
                  A
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">관리자</p>
                  <p className="text-xs text-gray-400 mt-0.5">admin@botong.kr</p>
                  <Button variant="secondary" size="sm" className="mt-2">사진 변경</Button>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { label: "이름", value: "관리자", type: "text" },
                  { label: "이메일", value: "admin@botong.kr", type: "email" },
                  { label: "연락처", value: "010-0000-0000", type: "tel" },
                ].map((field) => (
                  <div key={field.label}>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {field.label}
                    </label>
                    <input
                      type={field.type}
                      defaultValue={field.value}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/20 focus:border-[#5b6af4] transition-all"
                      readOnly
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 mt-6 pt-6 border-t border-gray-50">
                <Button variant="secondary">취소</Button>
                <Button variant="primary">저장</Button>
              </div>
            </Card>

            {/* Password Section */}
            <Card>
              <h3 className="text-sm font-semibold text-gray-800 mb-6">비밀번호 변경</h3>
              <div className="space-y-4">
                {[
                  { label: "현재 비밀번호", placeholder: "현재 비밀번호 입력" },
                  { label: "새 비밀번호", placeholder: "새 비밀번호 입력" },
                  { label: "새 비밀번호 확인", placeholder: "새 비밀번호 재입력" },
                ].map((field) => (
                  <div key={field.label}>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">
                      {field.label}
                    </label>
                    <input
                      type="password"
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/20 focus:border-[#5b6af4] transition-all placeholder-gray-300"
                      readOnly
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-end mt-6 pt-6 border-t border-gray-50">
                <Button variant="primary">비밀번호 변경</Button>
              </div>
            </Card>

            {/* Danger Zone */}
            <Card>
              <h3 className="text-sm font-semibold text-red-500 mb-1">위험 구역</h3>
              <p className="text-xs text-gray-400 mb-4">되돌릴 수 없는 작업입니다. 신중하게 진행하세요.</p>
              <div className="flex items-center justify-between p-4 rounded-xl border border-red-100 bg-red-50/50">
                <div>
                  <p className="text-sm font-medium text-gray-800">모든 데이터 초기화</p>
                  <p className="text-xs text-gray-400 mt-0.5">판매 내역, 재고, 상품 정보가 모두 삭제됩니다</p>
                </div>
                <Button variant="danger" size="sm">초기화</Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
