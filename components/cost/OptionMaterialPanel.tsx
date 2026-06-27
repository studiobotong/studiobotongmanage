"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Plus, Trash2, Loader2 } from "lucide-react";
import {
  getOptionMaterials,
  addOptionMaterial,
  removeOptionMaterial,
  getMaterials,
} from "@/lib/btmCost";
import type { BTMOptionMaterial, BTMMaterial } from "@/lib/btmCost";

interface Props {
  optionId: number;
  optionName: string;
  productName: string;
  onClose: () => void;
  onUpdated: () => void; // 원가표 새로고침용
}

export default function OptionMaterialPanel({ optionId, optionName, productName, onClose, onUpdated }: Props) {
  const [links, setLinks]         = useState<BTMOptionMaterial[]>([]);
  const [materials, setMaterials] = useState<BTMMaterial[]>([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [selMaterialId, setSelMaterialId] = useState("");
  const [qty, setQty]             = useState("1");
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [l, m] = await Promise.all([
      getOptionMaterials(optionId),
      getMaterials(),
    ]);

    // 부자재명 join
    const nameMap: Record<number, BTMMaterial> = {};
    for (const mat of m) nameMap[mat.id] = mat;

    const linked = l.map(link => ({
      ...link,
      material_name: nameMap[link.material_id]?.name ?? "알 수 없음",
      material_unit: nameMap[link.material_id]?.unit ?? "EA",
      material_category: nameMap[link.material_id]?.category ?? "",
    }));

    setLinks(linked);
    setMaterials(m);
    setLoading(false);
  }, [optionId]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!selMaterialId) return;
    const q = parseFloat(qty);
    if (isNaN(q) || q <= 0) return;

    setSaving(true);
    await addOptionMaterial(optionId, parseInt(selMaterialId), q);
    setSaving(false);
    setAdding(false);
    setSelMaterialId("");
    setQty("1");
    await load();
    onUpdated();
  };

  const handleRemove = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await removeOptionMaterial(id, optionId);
    await load();
    onUpdated();
  };

  // 이미 연결된 부자재는 드롭다운에서 제외
  const linkedIds = new Set(links.map(l => l.material_id));
  const availableMaterials = materials.filter(m => !linkedIds.has(m.id));

  const inputCls = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5b6af4]";

  return (
    <>
      {/* 오버레이 */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* 슬라이드 패널 */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col">
        {/* 헤더 */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">{productName}</p>
            <h3 className="text-sm font-semibold text-gray-800">{optionName}</h3>
            <p className="text-xs text-gray-400 mt-0.5">사용 부자재 연결</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm">불러오는 중…</span>
            </div>
          ) : (
            <>
              {/* 연결된 부자재 목록 */}
              {links.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400">
                  연결된 부자재가 없습니다.
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {links.map(link => (
                    <div key={link.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 bg-gray-50/50">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{link.material_name}</p>
                        <p className="text-xs text-gray-400">
                          {link.material_category} · 개당 {link.quantity_per_unit}{link.material_unit}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemove(link.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 추가 폼 */}
              {adding ? (
                <div className="border border-[#5b6af4]/30 rounded-lg p-3 bg-blue-50/30">
                  <p className="text-xs font-medium text-gray-600 mb-2">부자재 추가</p>
                  <select
                    value={selMaterialId}
                    onChange={e => setSelMaterialId(e.target.value)}
                    className={`${inputCls} w-full mb-2`}
                    autoFocus>
                    <option value="">— 부자재 선택 —</option>
                    {["포장재","사은품","택배포장","기타"].map(cat => (
                      <optgroup key={cat} label={cat}>
                        {availableMaterials
                          .filter(m => m.category === cat)
                          .map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.unit})
                            </option>
                          ))}
                      </optgroup>
                    ))}
                  </select>
                  <div className="flex gap-2 items-center">
                    <label className="text-xs text-gray-500 flex-shrink-0">개당 수량</label>
                    <input
                      type="number"
                      value={qty}
                      onChange={e => setQty(e.target.value)}
                      step="0.1"
                      min="0.1"
                      className={`${inputCls} w-24`}
                    />
                    <button
                      onClick={handleAdd}
                      disabled={saving || !selMaterialId}
                      className="flex-1 py-2 rounded-lg bg-[#5b6af4] text-white text-sm font-medium disabled:opacity-50">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "저장"}
                    </button>
                    <button
                      onClick={() => { setAdding(false); setSelMaterialId(""); setQty("1"); }}
                      className="px-3 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm">
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="w-full py-2.5 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-[#5b6af4] hover:text-[#5b6af4] transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  부자재 추가
                </button>
              )}
            </>
          )}
        </div>

        {/* 안내 */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400 leading-relaxed">
            부자재 구매내역을 먼저 입력해야 단가가 반영됩니다.<br />
            total_cost = 구매단가 + 부자재비 합계 + 공임비
          </p>
        </div>
      </div>
    </>
  );
}
