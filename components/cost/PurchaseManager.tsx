"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Loader2, Trash2, ExternalLink } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import {
  getPurchases, createPurchase, deletePurchase,
  getSuppliers, getMaterials,
} from "@/lib/btmCost";
import type { BTMPurchase, BTMSupplier, BTMMaterial } from "@/lib/btmCost";

interface BTMProductOption { id: number; product_id: string; option_name: string; }
interface BTMProduct { product_id: string; product_name: string; }

export default function PurchaseManager() {
  const [purchases, setPurchases]   = useState<BTMPurchase[]>([]);
  const [suppliers, setSuppliers]   = useState<BTMSupplier[]>([]);
  const [materials, setMaterials]   = useState<BTMMaterial[]>([]);
  const [products, setProducts]     = useState<BTMProduct[]>([]);
  const [options, setOptions]       = useState<BTMProductOption[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    purchase_date: new Date().toISOString().slice(0, 10),
    supplier_id: "" as string,
    purchase_type: "product" as "product" | "material",
    product_id: "" as string,
    option_id: "" as string,
    all_options: true,
    material_id: "" as string,
    quantity: 1,
    unit_price: 0,
    import_tax: 0,
    purchase_fee: 0,
    purchase_url: "",
    memo: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [p, s, m] = await Promise.all([getPurchases(), getSuppliers(), getMaterials()]);
    setPurchases(p); setSuppliers(s); setMaterials(m);

    const { btmSupabase } = await import("@/lib/btmSupabaseClient");
    const { data: prods } = await btmSupabase.from("btm_products").select("product_id, product_name").order("product_name");
    const { data: opts }  = await btmSupabase.from("btm_product_options").select("id, product_id, option_name").order("option_name");
    setProducts((prods ?? []) as BTMProduct[]);
    setOptions((opts ?? []) as BTMProductOption[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const finalPrice = form.quantity > 0
    ? Math.round((form.unit_price * form.quantity + form.import_tax + form.purchase_fee) / form.quantity)
    : form.unit_price;

  const handleSubmit = async () => {
    if (form.purchase_type === "product" && !form.product_id) {
      setToast("상품을 선택해주세요."); return;
    }
    if (form.purchase_type === "material" && !form.material_id) {
      setToast("부자재를 선택해주세요."); return;
    }
    if (form.unit_price <= 0) { setToast("단가를 입력해주세요."); return; }

    setSaving(true);
    const result = await createPurchase({
      purchase_date:  form.purchase_date,
      supplier_id:    form.supplier_id ? parseInt(form.supplier_id) : null,
      purchase_type:  form.purchase_type,
      product_id:     form.purchase_type === "product" ? form.product_id : null,
      option_id:      form.purchase_type === "product" && !form.all_options && form.option_id
                        ? parseInt(form.option_id) : null,
      material_id:    form.purchase_type === "material" ? parseInt(form.material_id) : null,
      quantity:       form.quantity,
      unit_price:     form.unit_price,
      import_tax:     form.import_tax,
      purchase_fee:   form.purchase_fee,
      purchase_url:   form.purchase_url || null,
      memo:           form.memo || null,
    });
    setSaving(false);

    if (result.ok) {
      setShowForm(false);
      setToast("저장 완료! 원가가 자동 갱신됩니다.");
      await load();
    } else {
      setToast(result.error ?? "저장 실패");
    }
    setTimeout(() => setToast(null), 3000);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await deletePurchase(id);
    await load();
  };

  const filteredOptions = options.filter(o => o.product_id === form.product_id);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button variant="primary" size="sm" icon={Plus} onClick={() => setShowForm(true)}>
          구매 입력
        </Button>
      </div>

      {/* 구매 입력 폼 */}
      {showForm && (
        <Card className="mb-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">구매 내역 입력</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">구매일</label>
              <input type="date" value={form.purchase_date}
                onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5b6af4]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">거래처 (선택)</label>
              <select value={form.supplier_id}
                onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5b6af4]">
                <option value="">— 선택 —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* 구매 타입 */}
          <div className="flex gap-2 mb-3">
            {(["product", "material"] as const).map(t => (
              <button key={t}
                onClick={() => setForm(f => ({ ...f, purchase_type: t, product_id: "", option_id: "", material_id: "", all_options: true }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.purchase_type === t
                    ? "bg-[#5b6af4] text-white border-[#5b6af4]"
                    : "bg-white text-gray-500 border-gray-200"
                }`}>
                {t === "product" ? "상품 구매" : "부자재 구매"}
              </button>
            ))}
          </div>

          {/* 상품 구매 */}
          {form.purchase_type === "product" && (
            <div className="space-y-3 mb-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">상품 선택</label>
                <select value={form.product_id}
                  onChange={e => setForm(f => ({ ...f, product_id: e.target.value, option_id: "", all_options: true }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5b6af4]">
                  <option value="">— 상품 선택 —</option>
                  {products.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
                </select>
              </div>
              {form.product_id && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs text-gray-500">옵션 단가</label>
                    <label className="flex items-center gap-1.5 ml-auto cursor-pointer">
                      <input type="checkbox" checked={form.all_options}
                        onChange={e => setForm(f => ({ ...f, all_options: e.target.checked, option_id: "" }))}
                        className="w-3.5 h-3.5 accent-[#5b6af4]" />
                      <span className="text-xs text-gray-500">전체 옵션 동일 단가</span>
                    </label>
                  </div>
                  {!form.all_options && (
                    <select value={form.option_id}
                      onChange={e => setForm(f => ({ ...f, option_id: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5b6af4]">
                      <option value="">— 옵션 선택 —</option>
                      {filteredOptions.map(o => <option key={o.id} value={o.id}>{o.option_name}</option>)}
                    </select>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 부자재 구매 */}
          {form.purchase_type === "material" && (
            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">부자재 선택</label>
              <select value={form.material_id}
                onChange={e => setForm(f => ({ ...f, material_id: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5b6af4]">
                <option value="">— 부자재 선택 —</option>
                {["포장재","사은품","택배포장","기타"].map(cat => (
                  <optgroup key={cat} label={cat}>
                    {materials.filter(m => m.category === cat).map(m =>
                      <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                    )}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {/* 수량 / 단가 / 관부가세 / 수수료 */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">수량</label>
              <input type="number" value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 1 }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5b6af4]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">단가 (원)</label>
              <input type="number" value={form.unit_price || ""}
                onChange={e => setForm(f => ({ ...f, unit_price: parseInt(e.target.value) || 0 }))}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5b6af4]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">관부가세 (원, 선택)</label>
              <input type="number" value={form.import_tax || ""}
                onChange={e => setForm(f => ({ ...f, import_tax: parseInt(e.target.value) || 0 }))}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5b6af4]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">구매수수료 (원, 선택)</label>
              <input type="number" value={form.purchase_fee || ""}
                onChange={e => setForm(f => ({ ...f, purchase_fee: parseInt(e.target.value) || 0 }))}
                placeholder="0"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5b6af4]" />
            </div>
          </div>

          {/* 최종 단가 표시 */}
          <div className="bg-blue-50 rounded-lg px-4 py-2.5 mb-3 flex justify-between items-center">
            <span className="text-xs text-blue-600">최종 개당 단가 (자동 계산)</span>
            <span className="text-sm font-bold text-blue-700">{finalPrice.toLocaleString()}원</span>
          </div>

          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">구매 링크 (선택)</label>
            <input type="url" value={form.purchase_url}
              onChange={e => setForm(f => ({ ...f, purchase_url: e.target.value }))}
              placeholder="https://..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5b6af4]" />
          </div>

          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block">메모 (선택)</label>
            <input type="text" value={form.memo}
              onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5b6af4]" />
          </div>

          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleSubmit} disabled={saving}
              icon={saving ? Loader2 : undefined}
              className={saving ? "[&_svg]:animate-spin" : ""}>
              {saving ? "저장 중..." : "저장"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>취소</Button>
          </div>
        </Card>
      )}

      {/* 구매 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /><span className="text-sm">불러오는 중…</span>
        </div>
      ) : purchases.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">구매 내역이 없습니다.</div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400">
                  <th className="text-left px-4 py-3 font-medium">구매일</th>
                  <th className="text-left px-3 py-3 font-medium">구분</th>
                  <th className="text-left px-3 py-3 font-medium">품목</th>
                  <th className="text-right px-3 py-3 font-medium">수량</th>
                  <th className="text-right px-3 py-3 font-medium">최종단가</th>
                  <th className="text-left px-3 py-3 font-medium">거래처</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{p.purchase_date}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        p.purchase_type === "product"
                          ? "bg-blue-50 text-blue-600"
                          : "bg-amber-50 text-amber-600"
                      }`}>
                        {p.purchase_type === "product" ? "상품" : "부자재"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 max-w-[200px]">
                      <p className="truncate">{p.memo ?? "—"}</p>
                      {p.purchase_url && (
                        <a href={p.purchase_url} target="_blank" rel="noreferrer"
                          className="text-[10px] text-blue-400 flex items-center gap-0.5 hover:text-blue-600">
                          <ExternalLink className="w-2.5 h-2.5" />링크
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">{p.quantity.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-gray-800">
                      {p.final_unit_price.toLocaleString()}원
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">—</td>
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => handleDelete(p.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
