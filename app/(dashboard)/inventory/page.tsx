import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Button from "@/components/Button";
import { Plus, Filter, AlertTriangle, CheckCircle2, Package } from "lucide-react";

const inventoryItems = [
  { name: "에코백 (네이비)", sku: "ECO-NV-001", stock: 42, min: 10, status: "정상" },
  { name: "에코백 (베이지)", sku: "ECO-BG-001", stock: 28, min: 10, status: "정상" },
  { name: "린넨 파우치 (아이보리)", sku: "LNP-IV-001", stock: 3, min: 5, status: "부족" },
  { name: "린넨 파우치 (네이비)", sku: "LNP-NV-001", stock: 7, min: 10, status: "부족" },
  { name: "캔버스 토트백", sku: "CVT-001", stock: 15, min: 8, status: "정상" },
  { name: "면 손수건 세트", sku: "CHS-001", stock: 0, min: 5, status: "품절" },
  { name: "코튼 파우치 (그레이)", sku: "CTP-GR-001", stock: 22, min: 10, status: "정상" },
  { name: "코튼 파우치 (블루)", sku: "CTP-BL-001", stock: 4, min: 10, status: "부족" },
];

const statusStyle: Record<string, { badge: string; icon: React.ElementType; iconColor: string }> = {
  정상: { badge: "bg-emerald-50 text-emerald-600", icon: CheckCircle2, iconColor: "text-emerald-400" },
  부족: { badge: "bg-amber-50 text-amber-600", icon: AlertTriangle, iconColor: "text-amber-400" },
  품절: { badge: "bg-red-50 text-red-600", icon: Package, iconColor: "text-red-400" },
};

export default function InventoryPage() {
  const lowStockCount = inventoryItems.filter((i) => i.status !== "정상").length;

  return (
    <>
      <Header title="Inventory" subtitle="재고 현황 관리" />
      <div className="px-8 py-8">
        <PageHeader
          title="재고 관리"
          description="상품별 재고 현황을 확인하고 조정하세요"
          actions={
            <>
              <Button variant="secondary" size="sm" icon={Filter}>필터</Button>
              <Button variant="primary" size="sm" icon={Plus}>재고 입고</Button>
            </>
          }
        />

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "전체 상품", value: `${inventoryItems.length}개`, bg: "bg-white", text: "text-gray-800" },
            { label: "재고 부족 / 품절", value: `${lowStockCount}개`, bg: "bg-amber-50", text: "text-amber-700" },
            { label: "정상 재고", value: `${inventoryItems.length - lowStockCount}개`, bg: "bg-emerald-50", text: "text-emerald-700" },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.bg} rounded-2xl border border-gray-100 shadow-sm p-5`}>
              <p className="text-xs text-gray-400 font-medium">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.text}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">상품명</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">SKU</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">현재 재고</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">최소 재고</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">상태</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {inventoryItems.map((item) => {
                  const s = statusStyle[item.status];
                  const Icon = s.icon;
                  const percent = Math.min((item.stock / Math.max(item.min * 3, 1)) * 100, 100);
                  return (
                    <tr
                      key={item.sku}
                      className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors"
                    >
                      <td className="px-3 py-3.5 text-sm font-medium text-gray-800">{item.name}</td>
                      <td className="px-3 py-3.5 text-xs font-mono text-gray-400">{item.sku}</td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-800 w-8">{item.stock}</span>
                          <div className="flex-1 max-w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                item.status === "정상"
                                  ? "bg-emerald-400"
                                  : item.status === "부족"
                                  ? "bg-amber-400"
                                  : "bg-red-400"
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-xs text-gray-400">{item.min}개</td>
                      <td className="px-3 py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ${s.badge}`}>
                          <Icon className={`w-3 h-3 ${s.iconColor}`} />
                          {item.status}
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <Button variant="ghost" size="sm">조정</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
