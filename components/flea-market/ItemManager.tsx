"use client";

import { useState } from "react";
import { Plus, Trash2, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import {
  createFleaMarketItem,
  updateFleaMarketItem,
  deleteFleaMarketItem,
  getFleaMarketItemOptions,
  createFleaMarketItemOption,
  deleteFleaMarketItemOption,
  updateFleaMarketItemOption,
} from "@/lib/btmFleaMarket";
import type { FleaMarketItem, FleaMarketItemOption } from "@/lib/btmFleaMarket";

interface ItemManagerProps {
  items: FleaMarketItem[];
  onRefresh: () => void;
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px", borderRadius: "10px",
  border: "1.5px solid #e5e5e5", background: "#f9f9f9",
  color: "#111", fontSize: "14px", outline: "none",
};

export default function ItemManager({ items, onRefresh }: ItemManagerProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [optionsMap, setOptionsMap] = useState<Record<number, FleaMarketItemOption[]>>({});
  const [newOptionName, setNewOptionName] = useState<Record<number, string>>({});
  const [newOptionPrice, setNewOptionPrice] = useState<Record<number, string>>({});
  const [editOptionId, setEditOptionId] = useState<number | null>(null);
  const [editOptionName, setEditOptionName] = useState("");
  const [editOptionPrice, setEditOptionPrice] = useState("");

  const loadOptions = async (itemId: number) => {
    const opts = await getFleaMarketItemOptions(itemId);
    setOptionsMap(prev => ({ ...prev, [itemId]: opts }));
  };

  const handleExpand = async (itemId: number) => {
    if (expandedId === itemId) {
      setExpandedId(null);
    } else {
      setExpandedId(itemId);
      await loadOptions(itemId);
    }
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

  const handleAddOption = async (itemId: number, defaultPrice: number) => {
    const name = (newOptionName[itemId] ?? "").trim();
    const priceStr = newOptionPrice[itemId] ?? String(defaultPrice);
    const price = parseInt(priceStr);
    if (!name || isNaN(price) || price < 0) return;
    const existing = optionsMap[itemId] ?? [];
    await createFleaMarketItemOption(itemId, name, existing.length, price);
    setNewOptionName(prev => ({ ...prev, [itemId]: "" }));
    setNewOptionPrice(prev => ({ ...prev, [itemId]: "" }));
    await loadOptions(itemId);
  };

  const handleUpdateOption = async (itemId: number) => {
    if (editOptionId === null) return;
    const name = editOptionName.trim();
    const price = parseInt(editOptionPrice);
    if (!name || isNaN(price) || price < 0) return;
    await updateFleaMarketItemOption(editOptionId, name, price);
    setEditOptionId(null);
    await loadOptions(itemId);
  };

  const handleDeleteOption = async (itemId: number, optionId: number) => {
    if (!confirm("옵션을 삭제하시겠습니까?")) return;
    await deleteFleaMarketItemOption(optionId);
    await loadOptions(itemId);
  };

  return (
    <div style={{ padding: "16px 20px 24px" }}>

      {adding ? (
        <div style={{ marginBottom: "16px", padding: "16px", borderRadius: "14px", background: "#f9f9f9", border: "1.5px solid #e5e5e5" }}>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "#888", marginBottom: "10px" }}>새 상품 추가</p>
          <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
            <input placeholder="상품명" value={newName} onChange={e => setNewName(e.target.value)}
              autoFocus style={{ ...inputStyle, flex: 2 }} />
            <input placeholder="가격" type="number" inputMode="numeric" value={newPrice}
              onChange={e => setNewPrice(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={handleAdd}
              style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "#111", color: "#fff", border: "none", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
              저장
            </button>
            <button onClick={() => { setAdding(false); setNewName(""); setNewPrice(""); }}
              style={{ padding: "10px 16px", borderRadius: "10px", background: "#f0f0f0", color: "#666", border: "none", fontSize: "14px", cursor: "pointer" }}>
              취소
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          style={{
            width: "100%", padding: "12px", borderRadius: "12px",
            border: "1.5px dashed #ddd", background: "#fafafa",
            color: "#888", fontSize: "14px", fontWeight: 500,
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", gap: "6px", marginBottom: "12px",
            boxSizing: "border-box"
          }}>
          <Plus size={16} /> 새 상품 추가
        </button>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px", color: "#bbb", fontSize: "14px" }}>
          등록된 상품이 없습니다.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map(item => (
            <div key={item.id} style={{ borderRadius: "12px", background: "#fff", border: "1px solid #f0f0f0", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 12px" }}>
                {editId === item.id ? (
                  <>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      style={{ ...inputStyle, flex: 2 }} />
                    <input value={editPrice} onChange={e => setEditPrice(e.target.value)}
                      type="number" inputMode="numeric" style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={() => handleUpdate(item)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#22c55e" }}>
                      <Check size={20} />
                    </button>
                    <button onClick={() => setEditId(null)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa" }}>
                      <X size={20} />
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 2, fontSize: "15px", fontWeight: 500, color: "#111" }}>{item.name}</span>
                    <span style={{ fontSize: "15px", fontWeight: 600, color: "#444" }}>{item.default_price.toLocaleString()}원</span>
                    <button
                      onClick={() => { setEditId(item.id); setEditName(item.name); setEditPrice(String(item.default_price)); }}
                      style={{ padding: "6px 10px", borderRadius: "8px", background: "#f5f5f5", border: "none", cursor: "pointer", fontSize: "12px", color: "#666", fontWeight: 500 }}>
                      수정
                    </button>
                    <button onClick={() => handleDelete(item.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#fca5a5" }}>
                      <Trash2 size={16} />
                    </button>
                    <button onClick={() => handleExpand(item.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", padding: "2px" }}>
                      {expandedId === item.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </>
                )}
              </div>

              {expandedId === item.id && (
                <div style={{ borderTop: "1px solid #f5f5f5", background: "#fafafa", padding: "12px 14px" }}>
                  <p style={{ fontSize: "11px", fontWeight: 600, color: "#aaa", marginBottom: "10px", letterSpacing: "0.5px" }}>
                    옵션 목록 <span style={{ fontWeight: 400 }}>(색상, 종류 등)</span>
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                    {(optionsMap[item.id] ?? []).length === 0 ? (
                      <span style={{ fontSize: "13px", color: "#ccc" }}>옵션 없음 (바로 판매 가능)</span>
                    ) : (
                      (optionsMap[item.id] ?? []).map(opt => (
                        <div key={opt.id} style={{
                          display: "flex", alignItems: "center", gap: "8px",
                          padding: "8px 10px", borderRadius: "10px",
                          background: "#fff", border: "1px solid #e5e5e5", fontSize: "13px", color: "#444"
                        }}>
                          {editOptionId === opt.id ? (
                            <>
                              <input value={editOptionName} onChange={e => setEditOptionName(e.target.value)}
                                style={{ ...inputStyle, flex: 2, fontSize: "13px", padding: "6px 10px" }} />
                              <input value={editOptionPrice} onChange={e => setEditOptionPrice(e.target.value)}
                                type="number" inputMode="numeric"
                                style={{ ...inputStyle, flex: 1, fontSize: "13px", padding: "6px 10px" }} />
                              <button onClick={() => void handleUpdateOption(item.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#22c55e" }}>
                                <Check size={16} />
                              </button>
                              <button onClick={() => setEditOptionId(null)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa" }}>
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <span style={{ flex: 2, fontWeight: 500 }}>{opt.option_name}</span>
                              <span style={{ fontWeight: 600, color: "#111" }}>{opt.price.toLocaleString()}원</span>
                              <button
                                onClick={() => { setEditOptionId(opt.id); setEditOptionName(opt.option_name); setEditOptionPrice(String(opt.price)); }}
                                style={{ padding: "4px 8px", borderRadius: "6px", background: "#f5f5f5", border: "none", cursor: "pointer", fontSize: "11px", color: "#666" }}>
                                수정
                              </button>
                              <button onClick={() => void handleDeleteOption(item.id, opt.id)}
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#fca5a5", padding: "0", lineHeight: 1 }}>
                                <X size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      placeholder="옵션명 (예: 빨강)"
                      value={newOptionName[item.id] ?? ""}
                      onChange={e => setNewOptionName(prev => ({ ...prev, [item.id]: e.target.value }))}
                      style={{ ...inputStyle, flex: 2, fontSize: "13px", padding: "8px 12px" }}
                    />
                    <input
                      placeholder="가격"
                      type="number"
                      inputMode="numeric"
                      value={newOptionPrice[item.id] ?? ""}
                      onChange={e => setNewOptionPrice(prev => ({ ...prev, [item.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter") void handleAddOption(item.id, item.default_price); }}
                      style={{ ...inputStyle, flex: 1, fontSize: "13px", padding: "8px 12px" }}
                    />
                    <button onClick={() => void handleAddOption(item.id, item.default_price)}
                      style={{
                        padding: "8px 14px", borderRadius: "10px", background: "#111",
                        color: "#fff", border: "none", fontSize: "13px", fontWeight: 500, cursor: "pointer"
                      }}>
                      추가
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
