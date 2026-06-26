"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { FleaMarketItem } from "@/lib/btmFleaMarket";

interface SaleInputModalProps {
  items: FleaMarketItem[];
  onConfirm: (itemName: string, price: number, isCard: boolean) => void;
  onClose: () => void;
  initialName?: string;
  initialPrice?: number;
  initialIsCard?: boolean;
  title?: string;
}

export default function SaleInputModal({
  items,
  onConfirm,
  onClose,
  initialName = "",
  initialPrice,
  initialIsCard = false,
  title = "판매 입력",
}: SaleInputModalProps) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [itemName, setItemName] = useState(initialName);
  const [price, setPrice] = useState(initialPrice !== undefined ? String(initialPrice) : "");
  const [isCard, setIsCard] = useState(initialIsCard);

  const handleSelectItem = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedId(val);
    if (val === "") return;
    const found = items.find(i => String(i.id) === val);
    if (found) {
      setItemName(found.name);
      setPrice(String(found.default_price));
    }
  };

  const handleConfirm = () => {
    if (!itemName.trim()) return alert("상품명을 입력해주세요.");
    const p = parseInt(price.replace(/,/g, ""));
    if (isNaN(p) || p < 0) return alert("금액을 입력해주세요.");
    onConfirm(itemName.trim(), p, isCard);
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "flex-end" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: "100%", background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#111" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}>
            <X size={22} />
          </button>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "8px", fontWeight: 600 }}>즐겨찾기에서 선택</p>
          <select
            value={selectedId}
            onChange={handleSelectItem}
            style={{
              width: "100%", padding: "12px 14px", borderRadius: "12px",
              border: "1.5px solid #e5e5e5", background: "#f9f9f9",
              fontSize: "15px", color: "#111", outline: "none",
              appearance: "none", WebkitAppearance: "none"
            }}
          >
            <option value="">— 직접 입력 —</option>
            {items.map(item => (
              <option key={item.id} value={String(item.id)}>
                {item.name} ({item.default_price.toLocaleString()}원)
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "8px", fontWeight: 600 }}>상품명</p>
          <input
            type="text"
            value={itemName}
            onChange={e => setItemName(e.target.value)}
            placeholder="상품명 입력"
            style={{
              width: "100%", padding: "12px 14px", borderRadius: "12px",
              border: "1.5px solid #e5e5e5", fontSize: "15px", color: "#111",
              outline: "none", background: "#f9f9f9", boxSizing: "border-box"
            }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "8px", fontWeight: 600 }}>판매 금액</p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="0"
              inputMode="numeric"
              style={{
                flex: 1, padding: "12px 14px", borderRadius: "12px",
                border: "1.5px solid #e5e5e5", fontSize: "24px", fontWeight: 600,
                color: "#111", outline: "none", background: "#f9f9f9", textAlign: "right"
              }}
            />
            <span style={{ fontSize: "18px", color: "#666" }}>원</span>
          </div>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px", fontWeight: 600 }}>결제 수단</p>
          <div style={{ display: "flex", gap: "10px" }}>
            {[
              { label: "💵 현금", value: false },
              { label: "💳 카드", value: true },
            ].map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => setIsCard(opt.value)}
                style={{
                  flex: 1, padding: "14px", borderRadius: "12px", fontSize: "16px", fontWeight: 500,
                  border: isCard === opt.value ? "2px solid #f97316" : "2px solid #e5e5e5",
                  background: isCard === opt.value ? "#fff7ed" : "#f9f9f9",
                  color: isCard === opt.value ? "#c2410c" : "#666",
                  cursor: "pointer"
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleConfirm}
          style={{
            width: "100%", padding: "16px", borderRadius: "14px", fontSize: "17px", fontWeight: 600,
            background: "#111", color: "#fff", border: "none", cursor: "pointer"
          }}
        >
          저장
        </button>
      </div>
    </div>
  );
}
