"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { FleaMarketItem } from "@/lib/btmFleaMarket";

interface LuckyDrawModalProps {
  items: FleaMarketItem[];
  onConfirm: (count: number, price: number, luckyItem: string, isCard: boolean) => void;
  onClose: () => void;
}

const LUCKY_PRICE = 2000;

export default function LuckyDrawModal({ items, onConfirm, onClose }: LuckyDrawModalProps) {
  const [count, setCount] = useState(1);
  const [luckyItem, setLuckyItem] = useState("");
  const [customItem, setCustomItem] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [isCard, setIsCard] = useState(false);

  const totalPrice = count * LUCKY_PRICE;
  const finalItem = useCustom ? customItem : luckyItem;

  const handleConfirm = () => {
    if (!finalItem.trim()) return alert("당첨 상품을 선택하거나 입력해주세요.");
    onConfirm(count, totalPrice, finalItem.trim(), isCard);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "24px",
          marginBottom: 0,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#111" }}>🎰 뽑기</h3>
          <button onClick={onClose} style={{ color: "#888", background: "none", border: "none", cursor: "pointer" }}>
            <X size={22} />
          </button>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>횟수 (1회 2,000원)</p>
          <div style={{ display: "flex", gap: "8px" }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setCount(n)}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: "12px", fontSize: "18px", fontWeight: 500,
                  border: count === n ? "2px solid #5b6af4" : "2px solid #e5e5e5",
                  background: count === n ? "#eef0fe" : "#f9f9f9",
                  color: count === n ? "#5b6af4" : "#111",
                  cursor: "pointer"
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <p style={{ textAlign: "right", marginTop: "8px", fontSize: "20px", fontWeight: 600, color: "#111" }}>
            {totalPrice.toLocaleString()}원
          </p>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>당첨 상품</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => { setLuckyItem(item.name); setUseCustom(false); }}
                style={{
                  padding: "8px 14px", borderRadius: "20px", fontSize: "13px",
                  border: luckyItem === item.name && !useCustom ? "2px solid #5b6af4" : "2px solid #e5e5e5",
                  background: luckyItem === item.name && !useCustom ? "#eef0fe" : "#f9f9f9",
                  color: luckyItem === item.name && !useCustom ? "#5b6af4" : "#111",
                  cursor: "pointer"
                }}
              >
                {item.name}
              </button>
            ))}
            <button
              onClick={() => { setUseCustom(true); setLuckyItem(""); }}
              style={{
                padding: "8px 14px", borderRadius: "20px", fontSize: "13px",
                border: useCustom ? "2px solid #5b6af4" : "2px solid #e5e5e5",
                background: useCustom ? "#eef0fe" : "#f9f9f9",
                color: useCustom ? "#5b6af4" : "#111",
                cursor: "pointer"
              }}
            >
              직접 입력
            </button>
          </div>
          {useCustom && (
            <input
              type="text"
              placeholder="당첨 상품명 입력"
              value={customItem}
              onChange={e => setCustomItem(e.target.value)}
              style={{
                width: "100%", padding: "12px", borderRadius: "12px", fontSize: "15px",
                border: "2px solid #e5e5e5", background: "#f9f9f9",
                color: "#111", outline: "none", boxSizing: "border-box"
              }}
            />
          )}
        </div>

        <div style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "10px" }}>결제 수단</p>
          <div style={{ display: "flex", gap: "10px" }}>
            {[false, true].map(card => (
              <button
                key={String(card)}
                onClick={() => setIsCard(card)}
                style={{
                  flex: 1, padding: "12px", borderRadius: "12px", fontSize: "15px", fontWeight: 500,
                  border: isCard === card ? "2px solid #5b6af4" : "2px solid #e5e5e5",
                  background: isCard === card ? "#eef0fe" : "#f9f9f9",
                  color: isCard === card ? "#5b6af4" : "#666",
                  cursor: "pointer"
                }}
              >
                {card ? "💳 카드" : "💵 현금"}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleConfirm}
          style={{
            width: "100%", padding: "16px", borderRadius: "14px", fontSize: "17px", fontWeight: 500,
            background: "#5b6af4", color: "#fff", border: "none", cursor: "pointer"
          }}
        >
          뽑기 기록
        </button>
      </div>
    </div>
  );
}
