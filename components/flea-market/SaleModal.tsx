"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { FleaMarketItem } from "@/lib/btmFleaMarket";

interface SaleModalProps {
  item: FleaMarketItem | { id: null; name: string; default_price: number };
  onConfirm: (price: number, isCard: boolean) => void;
  onClose: () => void;
}

export default function SaleModal({ item, onConfirm, onClose }: SaleModalProps) {
  const isOther = item.id === null;
  const [price, setPrice] = useState(isOther ? "" : String(item.default_price));
  const [isCard, setIsCard] = useState(false);

  const handleConfirm = () => {
    const p = parseInt(price.replace(/,/g, ""));
    if (isNaN(p) || p < 0) return;
    onConfirm(p, isCard);
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
          background: "var(--surface-2)",
          borderRadius: "20px 20px 0 0",
          padding: "24px",
          marginBottom: 0,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 500, color: "var(--text-primary)" }}>{item.name}</h3>
          <button onClick={onClose} style={{ color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer" }}>
            <X size={22} />
          </button>
        </div>

        {/* 금액 입력 */}
        <div style={{ marginBottom: "20px" }}>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "8px" }}>판매 금액</p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              autoFocus={isOther}
              placeholder={isOther ? "금액 입력" : undefined}
              style={{
                flex: 1, fontSize: "28px", fontWeight: 500, textAlign: "right",
                border: "none", borderBottom: "2px solid var(--border-accent)",
                background: "transparent", color: "var(--text-primary)", padding: "8px 0", outline: "none"
              }}
            />
            <span style={{ fontSize: "18px", color: "var(--text-secondary)" }}>원</span>
          </div>
        </div>

        {/* 결제 수단 */}
        <div style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "10px" }}>결제 수단</p>
          <div style={{ display: "flex", gap: "10px" }}>
            {[false, true].map(card => (
              <button
                key={String(card)}
                onClick={() => setIsCard(card)}
                style={{
                  flex: 1, padding: "12px", borderRadius: "12px", fontSize: "15px", fontWeight: 500,
                  border: isCard === card ? "2px solid var(--border-accent)" : "2px solid var(--border)",
                  background: isCard === card ? "var(--bg-accent)" : "var(--surface-1)",
                  color: isCard === card ? "var(--text-accent)" : "var(--text-secondary)",
                  cursor: "pointer"
                }}
              >
                {card ? "💳 카드" : "💵 현금"}
              </button>
            ))}
          </div>
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={handleConfirm}
          style={{
            width: "100%", padding: "16px", borderRadius: "14px", fontSize: "17px", fontWeight: 500,
            background: "var(--text-accent)", color: "#fff", border: "none", cursor: "pointer"
          }}
        >
          판매 기록
        </button>
      </div>
    </div>
  );
}
