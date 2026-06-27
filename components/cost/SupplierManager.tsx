"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Check, X, Loader2, ExternalLink } from "lucide-react";
import Card from "@/components/Card";
import Button from "@/components/Button";
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from "@/lib/btmCost";
import type { BTMSupplier } from "@/lib/btmCost";

const empty = { name: "", contact: "", address: "", website: "", memo: "" };

export default function SupplierManager() {
  const [suppliers, setSuppliers] = useState<BTMSupplier[]>([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [form, setForm]           = useState(empty);
  const [editId, setEditId]       = useState<number | null>(null);
  const [editForm, setEditForm]   = useState(empty);

  const load = useCallback(async () => {
    setLoading(true);
    setSuppliers(await getSuppliers());
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    await createSupplier({ name: form.name.trim(), contact: form.contact || null, address: form.address || null, website: form.website || null, memo: form.memo || null });
    setForm(empty); setAdding(false);
    await load();
  };

  const handleUpdate = async (id: number) => {
    await updateSupplier(id, { name: editForm.name, contact: editForm.contact || null, address: editForm.address || null, website: editForm.website || null, memo: editForm.memo || null });
    setEditId(null);
    await load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await deleteSupplier(id);
    await load();
  };

  const inputCls = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#5b6af4] w-full";

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button variant="primary" size="sm" icon={Plus} onClick={() => setAdding(true)}>
          거래처 추가
        </Button>
      </div>

      {adding && (
        <Card className="mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><label className="text-xs text-gray-500 mb-1 block">거래처명 *</label>
              <input placeholder="거래처명" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus className={inputCls} /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">연락처</label>
              <input placeholder="전화/이메일" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} className={inputCls} /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">오프라인 주소</label>
              <input placeholder="오프라인 주소" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inputCls} /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">온라인 주소</label>
              <input placeholder="https://..." value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className={inputCls} /></div>
            <div className="col-span-2"><label className="text-xs text-gray-500 mb-1 block">메모</label>
              <input placeholder="메모" value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} className={inputCls} /></div>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleAdd}>저장</Button>
            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setForm(empty); }}>취소</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /><span className="text-sm">불러오는 중…</span>
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">등록된 거래처가 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {suppliers.map(s => (
            <Card key={s.id} className="py-3">
              {editId === s.id ? (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 mb-1 block">거래처명</label>
                    <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={inputCls} /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">연락처</label>
                    <input value={editForm.contact} onChange={e => setEditForm(f => ({ ...f, contact: e.target.value }))} className={inputCls} /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">오프라인 주소</label>
                    <input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} className={inputCls} /></div>
                  <div><label className="text-xs text-gray-500 mb-1 block">온라인 주소</label>
                    <input value={editForm.website} onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} className={inputCls} /></div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 mb-1 block">메모</label>
                    <input value={editForm.memo}
                      onChange={e => setEditForm(f => ({ ...f, memo: e.target.value }))}
                      placeholder="메모" className={inputCls} />
                  </div>
                  <div className="col-span-2 flex gap-2">
                    <button onClick={() => handleUpdate(s.id)} className="text-emerald-500 flex items-center gap-1 text-sm"><Check className="w-4 h-4" />저장</button>
                    <button onClick={() => setEditId(null)} className="text-gray-400 flex items-center gap-1 text-sm"><X className="w-4 h-4" />취소</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800 mb-1">{s.name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                      {s.contact && <p className="text-xs text-gray-500">📞 {s.contact}</p>}
                      {s.address && <p className="text-xs text-gray-500">📍 {s.address}</p>}
                      {s.website && (
                        <a href={s.website} target="_blank" rel="noreferrer"
                          className="text-xs text-blue-500 flex items-center gap-0.5 hover:text-blue-700">
                          <ExternalLink className="w-3 h-3" />{s.website}
                        </a>
                      )}
                      {s.memo && <p className="text-xs text-gray-400">{s.memo}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => { setEditId(s.id); setEditForm({ name: s.name, contact: s.contact ?? "", address: s.address ?? "", website: s.website ?? "", memo: s.memo ?? "" }); }}
                      className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200">수정</button>
                    <button onClick={() => handleDelete(s.id)} className="text-gray-300 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
