"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { FleaMarketItem } from "@/lib/btmFleaMarket";

interface LuckyDrawModalProps {
  items: FleaMarketItem[];
  onConfirm: (count: number, price: number, luckyItem: string, isCard: boolean) => void;
  onClose: () => void;
}

const DEFAULT_PRICE = 2000;

export default function LuckyDrawModal({ items, onConfirm, onClose }: LuckyDrawModalProps) {
  const [count, setCount] = useState(1);
  const [priceOverride, setPriceOverride] = useState(String(DEFAULT_PRICE));
  const [luckyItem, setLuckyItem] = useState("");
  const [customItem, setCustomItem] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [isCard, setIsCard] = useState(false);

  const totalPrice = parseInt(priceOverride || "0") * count;
  const finalItem = useCustom ? customItem : luckyItem;

  const handleConfirm = () => {
    if (!finalItem.trim()) return alert("당첨 상품을 선택하거나 입력해주세요.");
    onConfirm(count, totalPrice, finalItem.trim(), isCard);
  };

  return (
    <div onClick={onClose}
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: "100%", background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px", maxHeight: "90vh", overflowY: "auto" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#111" }}>🎰 뽑기</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}><X size={22} /></button>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px", fontWeight: 600 }}>횟수</p>
          <div style={{ display: "flex", gap: "8px" }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setCount(n)}
                style={{
                  flex: 1, padding: "14px 0", borderRadius: "12px", fontSize: "18px", fontWeight: 600,
                  border: count === n ? "2px solid #f97316" : "2px solid #e5e5e5",
                  background: count === n ? "#fff7ed" : "#f9f9f9",
                  color: count === n ? "#c2410c" : "#111", cursor: "pointer"
                }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "8px", fontWeight: 600 }}>회당 금액 (기본 2,000원)</p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input type="number" value={priceOverride} onChange={e => setPriceOverride(e.target.value)}
              inputMode="numeric"
              style={{ flex: 1, padding: "12px 14px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "20px", fontWeight: 600, color: "#111", outline: "none", background: "#f9f9f9", textAlign: "right" }} />
            <span style={{ fontSize: "16px", color: "#666" }}>원</span>
          </div>
          <p style={{ textAlign: "right", marginTop: "6px", fontSize: "20px", fontWeight: 700, color: "#f97316" }}>
            합계: {totalPrice.toLocaleString()}원
          </p>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px", fontWeight: 600 }}>당첨 상품</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
            {items.map(item => (
              <button key={item.id} onClick={() => { setLuckyItem(item.name); setUseCustom(false); }}
                style={{
                  padding: "8px 16px", borderRadius: "20px", fontSize: "14px",
                  border: luckyItem === item.name && !useCustom ? "2px solid #f97316" : "2px solid #e5e5e5",
                  background: luckyItem === item.name && !useCustom ? "#fff7ed" : "#f9f9f9",
                  color: luckyItem === item.name && !useCustom ? "#c2410c" : "#444",
                  cursor: "pointer", fontWeight: 500
                }}>
                {item.name}
              </button>
            ))}
            <button onClick={() => { setUseCustom(true); setLuckyItem(""); }}
              style={{
                padding: "8px 16px", borderRadius: "20px", fontSize: "14px",
                border: useCustom ? "2px solid #f97316" : "2px solid #e5e5e5",
                background: useCustom ? "#fff7ed" : "#f9f9f9",
                color: useCustom ? "#c2410c" : "#444",
                cursor: "pointer", fontWeight: 500
              }}>
              직접 입력
            </button>
          </div>
          {useCustom && (
            <input type="text" placeholder="당첨 상품명 입력" value={customItem} onChange={e => setCustomItem(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: "1.5px solid #e5e5e5", fontSize: "15px", color: "#111", outline: "none", background: "#f9f9f9", boxSizing: "border-box" }} />
          )}
        </div>

        <div style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px", fontWeight: 600 }}>결제 수단</p>
          <div style={{ display: "flex", gap: "10px" }}>
            {[{ label: "💵 현금", value: false }, { label: "💳 카드", value: true }].map(opt => (
              <button key={String(opt.value)} onClick={() => setIsCard(opt.value)}
                style={{
                  flex: 1, padding: "14px", borderRadius: "12px", fontSize: "16px", fontWeight: 500,
                  border: isCard === opt.value ? "2px solid #f97316" : "2px solid #e5e5e5",
                  background: isCard === opt.value ? "#fff7ed" : "#f9f9f9",
                  color: isCard === opt.value ? "#c2410c" : "#666", cursor: "pointer"
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button onClick={handleConfirm}
          style={{ width: "100%", padding: "16px", borderRadius: "14px", fontSize: "17px", fontWeight: 600, background: "#111", color: "#fff", border: "none", cursor: "pointer" }}>
          뽑기 기록
        </button>
      </div>
    </div>
  );
}
