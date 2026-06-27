"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Check, X, Loader2 } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import { getMaterials, createMaterial, updateMaterial, deleteMaterial } from "@/lib/btmCost";
import type { BTMMaterial } from "@/lib/btmCost";

const CATEGORIES = ["포장재", "사은품", "택배포장", "기타"] as const;

const emptyForm = { name: "", unit: "EA", category: "기타" as string, unit_price: 0, memo: "" };

export default function MaterialManager() {
  const [materials, setMaterials] = useState<BTMMaterial[]>([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [form, setForm]           = useState(emptyForm);
  const [editId, setEditId]       = useState<number | null>(null);
  const [editForm, setEditForm]   = useState(emptyForm);
  const [catFilter, setCatFilter] = useState<string>("전체");

  const load = useCallback(async () => {
    setLoading(true);
    setMaterials(await getMaterials());
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    await createMaterial({
      name: form.name.trim(),
      unit: form.unit,
      category: form.category,
      unit_price: form.unit_price,
      memo: form.memo || null,
    });
    setForm(emptyForm);
    setAdding(false);
    await load();
  };

  const handleUpdate = async (id: number) => {
    await updateMaterial(id, {
      name: editForm.name,
      unit: editForm.unit,
      category: editForm.category,
      unit_price: editForm.unit_price,
      memo: editForm.memo || null,
    });
    setEditId(null);
    await load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await deleteMaterial(id);
    await load();
  };

  const filtered = catFilter === "전체" ? materials : materials.filter(m => m.category === catFilter);

  const inputCls = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5b6af4]";

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {["전체", ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              catFilter === c ? "bg-[#5b6af4] text-white border-[#5b6af4]" : "bg-white text-gray-500 border-gray-200"
            }`}>
            {c}
          </button>
        ))}
        <Button variant="primary" size="sm" icon={Plus} className="ml-auto" onClick={() => setAdding(true)}>
          부자재 추가
        </Button>
      </div>

      {adding && (
        <Card className="mb-4">
          <div className="flex gap-2 flex-wrap mb-2">
            <input placeholder="부자재명" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus className={`${inputCls} flex-1 min-w-32`} />
            <input placeholder="단위(EA/롤/박스 등)" value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              className={`${inputCls} w-32`} />
            <select value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className={`${inputCls} w-28`}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2 flex-wrap mb-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 flex-shrink-0">단가(원)</label>
              <input type="number" placeholder="0" value={form.unit_price || ""}
                onChange={e => setForm(f => ({ ...f, unit_price: parseInt(e.target.value) || 0 }))}
                className={`${inputCls} w-28`} />
            </div>
            <input placeholder="비고 (선택)" value={form.memo}
              onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
              className={`${inputCls} flex-1 min-w-32`} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd}
              className="bg-[#5b6af4] text-white px-4 py-2 rounded-lg text-sm font-medium">저장</button>
            <button onClick={() => { setAdding(false); setForm(emptyForm); }}
              className="bg-gray-100 text-gray-500 px-4 py-2 rounded-lg text-sm">취소</button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /><span className="text-sm">불러오는 중…</span>
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400">
                <th className="text-left px-4 py-3 font-medium">부자재명</th>
                <th className="text-center px-3 py-3 font-medium">단위</th>
                <th className="text-right px-3 py-3 font-medium">단가</th>
                <th className="text-center px-3 py-3 font-medium">카테고리</th>
                <th className="text-left px-3 py-3 font-medium">비고</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  {editId === m.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                          className={`${inputCls} w-full`} />
                      </td>
                      <td className="px-3 py-2">
                        <input value={editForm.unit} onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))}
                          className={`${inputCls} w-20`} />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" value={editForm.unit_price || ""}
                          onChange={e => setEditForm(f => ({ ...f, unit_price: parseInt(e.target.value) || 0 }))}
                          className={`${inputCls} w-24`} placeholder="0" />
                      </td>
                      <td className="px-3 py-2">
                        <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                          className={inputCls}>
                          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input value={editForm.memo} onChange={e => setEditForm(f => ({ ...f, memo: e.target.value }))}
                          className={`${inputCls} w-full`} placeholder="비고" />
                      </td>
                      <td className="px-4 py-2 flex gap-2">
                        <button onClick={() => handleUpdate(m.id)} className="text-emerald-500"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditId(null)} className="text-gray-400"><X className="w-4 h-4" /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-gray-800">{m.name}</td>
                      <td className="px-3 py-3 text-center text-gray-500 text-xs">{m.unit}</td>
                      <td className="px-3 py-3 text-right text-gray-700 text-sm font-medium">
                        {m.unit_price > 0 ? `${m.unit_price.toLocaleString()}원` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">{m.category}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-400">{m.memo ?? "—"}</td>
                      <td className="px-4 py-3 flex gap-2 justify-end">
                        <button onClick={() => {
                          setEditId(m.id);
                          setEditForm({ name: m.name, unit: m.unit, category: m.category, unit_price: m.unit_price ?? 0, memo: m.memo ?? "" });
                        }} className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200">수정</button>
                        <button onClick={() => handleDelete(m.id)} className="text-gray-300 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
