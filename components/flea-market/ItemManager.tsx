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

  const handleAdd = async () => {
    if (!newName.trim() || !newPrice) return;
    await createFleaMarketItem(newName.trim(), parseInt(newPrice), items.length);
    setNewName(""); setNewPrice(""); setAdding(false);
    onRefresh();
  };

  const handleUpdate = async (item: FleaMarketItem) => {
    await updateFleaMarketItem(item.id, editName.trim(), parseInt(editPrice), item.is_active);
    setEditId(null); onRefresh();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await deleteFleaMarketItem(id);
    onRefresh();
  };

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: 500, color: "var(--text-primary)" }}>상품 관리</h3>
        <button
          onClick={() => setAdding(true)}
          style={{
            display: "flex", alignItems: "center", gap: "4px", padding: "8px 14px",
            borderRadius: "10px", background: "var(--text-accent)", color: "#fff",
            border: "none", fontSize: "13px", cursor: "pointer"
          }}
        >
          <Plus size={14} /> 추가
        </button>
      </div>

      {adding && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "center" }}>
          <input
            placeholder="상품명"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{ flex: 2, padding: "10px", borderRadius: "10px", border: "1.5px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)", fontSize: "14px", outline: "none" }}
          />
          <input
            placeholder="가격"
            type="number"
            value={newPrice}
            onChange={e => setNewPrice(e.target.value)}
            style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1.5px solid var(--border)", background: "var(--surface-1)", color: "var(--text-primary)", fontSize: "14px", outline: "none" }}
          />
          <button onClick={handleAdd} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-accent)" }}><Check size={20} /></button>
          <button onClick={() => setAdding(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}><X size={20} /></button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {items.map(item => (
          <div key={item.id} style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "12px",
            borderRadius: "12px", background: "var(--surface-1)", border: "1px solid var(--border)"
          }}>
            {editId === item.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  style={{ flex: 2, padding: "6px", borderRadius: "8px", border: "1.5px solid var(--border-accent)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "14px", outline: "none" }} />
                <input value={editPrice} onChange={e => setEditPrice(e.target.value)} type="number"
                  style={{ flex: 1, padding: "6px", borderRadius: "8px", border: "1.5px solid var(--border-accent)", background: "var(--surface-2)", color: "var(--text-primary)", fontSize: "14px", outline: "none" }} />
                <button onClick={() => handleUpdate(item)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-accent)" }}><Check size={18} /></button>
                <button onClick={() => setEditId(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}><X size={18} /></button>
              </>
            ) : (
              <>
                <span style={{ flex: 2, fontSize: "15px", color: "var(--text-primary)" }}>{item.name}</span>
                <span style={{ flex: 1, fontSize: "14px", color: "var(--text-secondary)", textAlign: "right" }}>{item.default_price.toLocaleString()}원</span>
                <button onClick={() => { setEditId(item.id); setEditName(item.name); setEditPrice(String(item.default_price)); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: "12px" }}>수정</button>
                <button onClick={() => handleDelete(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-danger)" }}><Trash2 size={16} /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
