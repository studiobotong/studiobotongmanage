"use client";

import { useState } from "react";
import { Plus, Trash2, Check, X } from "lucide-react";
import {
  createFleaMarketItem,
  updateFleaMarketItem,
  deleteFleaMarketItem,
} from "@/lib/btmFleaMarket";
import type { FleaMarketItem } from "@/lib/btmFleaMarket";

interface ItemManagerProps {
  items: FleaMarketItem[];
  onRefresh: () => void;
}

export default function ItemManager({ items, onRefresh }: ItemManagerProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const inputStyle = {
    padding: "10px 12px", borderRadius: "10px",
    border: "1.5px solid #e5e5e5", background: "#f9f9f9",
    color: "#111", fontSize: "14px", outline: "none"
  };

  const handleAdd = async () => {
    if (!newName.trim() || !newPrice) return;
    await createFleaMarketItem(newName.trim(), parseInt(newPrice), items.length);
    setNewName(""); setNewPrice(""); setAdding(false);
    onRefresh();
  };

  const handleUpdate = async (item: FleaMarketItem) => {
    if (!editName.trim() || !editPrice) return;
    await updateFleaMarketItem(item.id, editName.trim(), parseInt(editPrice), item.is_active);
    setEditId(null);
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await deleteFleaMarketItem(id);
    onRefresh();
  };

  return (
    <div style={{ padding: "16px 20px 24px" }}>

      {adding ? (
        <div style={{ marginBottom: "16px", padding: "16px", borderRadius: "14px", background: "#f9f9f9", border: "1.5px solid #e5e5e5" }}>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "#888", marginBottom: "10px" }}>새 상품 추가</p>
          <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
            <input
              placeholder="상품명"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
              style={{ ...inputStyle, flex: 2 }}
            />
            <input
              placeholder="가격"
              type="number"
              inputMode="numeric"
              value={newPrice}
              onChange={e => setNewPrice(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={handleAdd}
              style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "#111", color: "#fff", border: "none", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}
            >
              저장
            </button>
            <button
              onClick={() => { setAdding(false); setNewName(""); setNewPrice(""); }}
              style={{ padding: "10px 16px", borderRadius: "10px", background: "#f0f0f0", color: "#666", border: "none", fontSize: "14px", cursor: "pointer" }}
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            width: "100%", padding: "12px", borderRadius: "12px",
            border: "1.5px dashed #ddd", background: "#fafafa",
            color: "#888", fontSize: "14px", fontWeight: 500,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            marginBottom: "12px"
          }}
        >
          <Plus size={16} /> 새 상품 추가
        </button>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px", color: "#bbb", fontSize: "14px" }}>
          등록된 상품이 없습니다.<br />위 버튼으로 추가해 주세요.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map(item => (
            <div key={item.id} style={{
              display: "flex", alignItems: "center", gap: "8px", padding: "14px 12px",
              borderRadius: "12px", background: "#fff", border: "1px solid #f0f0f0",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
            }}>
              {editId === item.id ? (
                <>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    style={{ ...inputStyle, flex: 2 }}
                  />
                  <input
                    value={editPrice}
                    onChange={e => setEditPrice(e.target.value)}
                    type="number"
                    inputMode="numeric"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button onClick={() => handleUpdate(item)} style={{ background: "none", border: "none", cursor: "pointer", color: "#22c55e" }}>
                    <Check size={20} />
                  </button>
                  <button onClick={() => setEditId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa" }}>
                    <X size={20} />
                  </button>
                </>
              ) : (
                <>
                  <span style={{ flex: 2, fontSize: "15px", fontWeight: 500, color: "#111" }}>{item.name}</span>
                  <span style={{ fontSize: "15px", fontWeight: 600, color: "#444" }}>{item.default_price.toLocaleString()}원</span>
                  <button
                    onClick={() => { setEditId(item.id); setEditName(item.name); setEditPrice(String(item.default_price)); }}
                    style={{ padding: "6px 10px", borderRadius: "8px", background: "#f5f5f5", border: "none", cursor: "pointer", fontSize: "12px", color: "#666", fontWeight: 500 }}
                  >
                    수정
                  </button>
                  <button onClick={() => handleDelete(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#fca5a5" }}>
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
