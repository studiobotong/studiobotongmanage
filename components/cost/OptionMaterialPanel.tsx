"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Plus, Trash2, Loader2 } from "lucide-react";
import {
  getOptionMaterials, addOptionMaterial, removeOptionMaterial,
  getProductMaterials, addProductMaterial, removeProductMaterial,
  getMaterials,
} from "@/lib/btmCost";
import type { BTMOptionMaterial, BTMMaterial } from "@/lib/btmCost";

interface Props {
  mode: "product" | "option";
  productId: string;
  productName: string;
  optionId?: number;
  optionName?: string;
  onClose: () => void;
  onUpdated: () => void;
}

export default function OptionMaterialPanel({
  mode, productId, productName, optionId, optionName, onClose, onUpdated
}: Props) {
  const [commonLinks, setCommonLinks]   = useState<BTMOptionMaterial[]>([]);
  const [optionLinks, setOptionLinks]   = useState<BTMOptionMaterial[]>([]);
  const [materials, setMaterials]       = useState<BTMMaterial[]>([]);
  const [loading, setLoading]           = useState(true);
  const [adding, setAdding]             = useState(false);
  const [selMaterialId, setSelMaterialId] = useState("");
  const [qty, setQty]                   = useState("1");
  const [saving, setSaving]             = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [common, opts, allMats] = await Promise.all([
      getProductMaterials(productId),
      mode === "option" && optionId ? getOptionMaterials(optionId) : Promise.resolve([]),
      getMaterials(),
    ]);

    const nameMap: Record<number, BTMMaterial> = {};
    for (const m of allMats) nameMap[m.id] = m;

    const enrich = (links: BTMOptionMaterial[]) => links.map(l => ({
      ...l,
      material_name: nameMap[l.material_id]?.name ?? "알 수 없음",
      material_unit: nameMap[l.material_id]?.unit ?? "EA",
      material_category: nameMap[l.material_id]?.category ?? "",
    }));

    setCommonLinks(enrich(common));
    setOptionLinks(enrich(opts));
    setMaterials(allMats);
    setLoading(false);
  }, [mode, productId, optionId]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!selMaterialId) return;
    const q = parseFloat(qty);
    if (isNaN(q) || q <= 0) return;

    setSaving(true);
    if (mode === "product") {
      await addProductMaterial(productId, parseInt(selMaterialId), q);
    } else if (mode === "option" && optionId) {
      await addOptionMaterial(optionId, parseInt(selMaterialId), q);
    }
    setSaving(false);
    setAdding(false);
    setSelMaterialId("");
    setQty("1");
    await load();
    onUpdated();
  };

  const handleRemove = async (link: BTMOptionMaterial, isCommon: boolean) => {
    if (!confirm("삭제하시겠습니까?")) return;
    if (isCommon) {
      await removeProductMaterial(link.id, productId);
    } else if (optionId) {
      await removeOptionMaterial(link.id, optionId);
    }
    await load();
    onUpdated();
  };

  // 이미 연결된 부자재는 드롭다운에서 제외
  const linkedIds = new Set([
    ...commonLinks.map(l => l.material_id),
    ...optionLinks.map(l => l.material_id),
  ]);
  const availableMaterials = materials.filter(m => !linkedIds.has(m.id));

  const inputCls = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5b6af4]";

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col">
        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">{productName}</p>
            <h3 className="text-sm font-semibold text-gray-800">
              {mode === "product" ? "공통 부자재 (전체 옵션)" : optionName}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {mode === "product" ? "모든 옵션에 공통 적용" : "이 옵션에만 추가"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" /><span className="text-sm">불러오는 중…</span>
            </div>
          ) : (
            <>
              {/* 공통 부자재 (option 모드에서도 표시, 읽기 전용) */}
              {mode === "option" && commonLinks.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-gray-300 inline-block"></span>
                    공통 부자재 (전체 옵션 적용 중)
                  </p>
                  <div className="space-y-1.5">
                    {commonLinks.map(link => (
                      <div key={link.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-500">{link.material_name}</p>
                          <p className="text-[10px] text-gray-400">
                            {link.material_category} · 개당 {link.quantity_per_unit}{link.material_unit}
                          </p>
                        </div>
                        <span className="text-[10px] text-gray-300">공통</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 현재 모드에 맞는 부자재 목록 */}
              <div className="mb-4">
                {mode === "option" && (
                  <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#5b6af4] inline-block"></span>
                    이 옵션 전용 부자재
                  </p>
                )}
                {(mode === "product" ? commonLinks : optionLinks).length === 0 ? (
                  <div className="text-center py-6 text-sm text-gray-400">
                    {mode === "product" ? "공통 부자재가 없습니다." : "옵션 전용 부자재가 없습니다."}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(mode === "product" ? commonLinks : optionLinks).map(link => (
                      <div key={link.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 bg-white">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{link.material_name}</p>
                          <p className="text-xs text-gray-400">
                            {link.material_category} · 개당 {link.quantity_per_unit}{link.material_unit}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRemove(link, mode === "product")}
                          className="text-gray-300 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 추가 폼 */}
              {adding ? (
                <div className="border border-[#5b6af4]/30 rounded-lg p-3 bg-blue-50/30">
                  <p className="text-xs font-medium text-gray-600 mb-2">부자재 추가</p>
                  <select value={selMaterialId} onChange={e => setSelMaterialId(e.target.value)}
                    className={`${inputCls} w-full mb-2`} autoFocus>
                    <option value="">— 부자재 선택 —</option>
                    {["포장재","사은품","택배포장","기타"].map(cat => (
                      <optgroup key={cat} label={cat}>
                        {availableMaterials.filter(m => m.category === cat).map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <div className="flex gap-2 items-center">
                    <label className="text-xs text-gray-500 flex-shrink-0">개당 수량</label>
                    <input type="number" value={qty} onChange={e => setQty(e.target.value)}
                      step="0.1" min="0.1" className={`${inputCls} w-24`} />
                    <button onClick={handleAdd} disabled={saving || !selMaterialId}
                      className="flex-1 py-2 rounded-lg bg-[#5b6af4] text-white text-sm font-medium disabled:opacity-50">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "저장"}
                    </button>
                    <button onClick={() => { setAdding(false); setSelMaterialId(""); setQty("1"); }}
                      className="px-3 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm">취소</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAdding(true)}
                  className="w-full py-2.5 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-[#5b6af4] hover:text-[#5b6af4] transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  {mode === "product" ? "공통 부자재 추가" : "옵션 전용 부자재 추가"}
                </button>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400 leading-relaxed">
            {mode === "product"
              ? "여기서 추가한 부자재는 이 상품의 모든 옵션에 공통 적용됩니다."
              : "공통 부자재 + 이 옵션 전용 부자재가 합산되어 원가에 반영됩니다."}
          </p>
        </div>
      </div>
    </>
  );
}
