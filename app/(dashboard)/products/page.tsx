import Header from "@/components/Header";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Button from "@/components/Button";
import { Plus, Search, Edit2, Trash2, Eye } from "lucide-react";

const products = [
  { id: "P001", name: "에코백 (네이비)", category: "가방", price: "27,000", stock: 42, status: "판매중" },
  { id: "P002", name: "에코백 (베이지)", category: "가방", price: "27,000", stock: 28, status: "판매중" },
  { id: "P003", name: "린넨 파우치 (아이보리)", category: "파우치", price: "28,000", stock: 3, status: "판매중" },
  { id: "P004", name: "린넨 파우치 (네이비)", category: "파우치", price: "28,000", stock: 7, status: "판매중" },
  { id: "P005", name: "캔버스 토트백", category: "가방", price: "38,000", stock: 15, status: "판매중" },
  { id: "P006", name: "면 손수건 세트", category: "소품", price: "18,000", stock: 0, status: "품절" },
  { id: "P007", name: "코튼 파우치 (그레이)", category: "파우치", price: "21,000", stock: 22, status: "판매중" },
  { id: "P008", name: "왁스 캔버스 파우치", category: "파우치", price: "35,000", stock: 0, status: "준비중" },
];

const statusStyle: Record<string, string> = {
  판매중: "bg-emerald-50 text-emerald-600",
  품절: "bg-red-50 text-red-500",
  준비중: "bg-gray-100 text-gray-500",
};

const categories = ["전체", "가방", "파우치", "소품"];

export default function ProductsPage() {
  return (
    <>
      <Header title="Products" subtitle="상품 관리" />
      <div className="px-8 py-8">
        <PageHeader
          title="상품 관리"
          description="상품 목록을 확인하고 정보를 관리하세요"
          actions={
            <Button variant="primary" size="sm" icon={Plus}>상품 추가</Button>
          }
        />

        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                className={`px-4 py-2 text-sm rounded-xl font-medium transition-all ${
                  cat === "전체"
                    ? "bg-[#5b6af4] text-white shadow-sm"
                    : "bg-white text-gray-500 border border-gray-100 hover:bg-gray-50"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl border border-gray-100 text-gray-400 text-sm">
            <Search className="w-4 h-4" />
            <input
              type="text"
              placeholder="상품 검색..."
              className="outline-none bg-transparent text-sm text-gray-600 placeholder-gray-300 w-40"
              readOnly
            />
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {products.slice(0, 4).map((product) => (
            <Card key={product.id} padding="sm" hover>
              <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl mb-4 flex items-center justify-center">
                <span className="text-3xl">🛍️</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-start justify-between">
                  <h4 className="text-sm font-semibold text-gray-800 leading-tight">{product.name}</h4>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-lg flex-shrink-0 ml-2 ${statusStyle[product.status]}`}>
                    {product.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{product.category}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-bold text-gray-900">{product.price}원</span>
                  <span className="text-xs text-gray-400">재고 {product.stock}개</span>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-50">
                <Button variant="ghost" size="sm" icon={Eye} className="flex-1 justify-center">보기</Button>
                <Button variant="ghost" size="sm" icon={Edit2} className="flex-1 justify-center">수정</Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card padding="sm">
          <div className="flex items-center justify-between px-2 mb-4">
            <h3 className="text-sm font-semibold text-gray-700">전체 상품 목록</h3>
            <span className="text-xs text-gray-400">{products.length}개 상품</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">상품명</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">카테고리</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">가격</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">재고</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">상태</th>
                  <th className="text-left text-xs font-medium text-gray-400 px-3 py-2.5">관리</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-base flex-shrink-0">🛍️</div>
                        <span className="text-sm font-medium text-gray-800">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-xs text-gray-400">{product.category}</td>
                    <td className="px-3 py-3.5 text-sm font-semibold text-gray-800">{product.price}원</td>
                    <td className="px-3 py-3.5 text-sm text-gray-600">{product.stock}개</td>
                    <td className="px-3 py-3.5">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-lg ${statusStyle[product.status]}`}>
                        {product.status}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" icon={Edit2}>수정</Button>
                        <Button variant="ghost" size="sm" icon={Trash2} className="hover:text-red-500 hover:bg-red-50">삭제</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
