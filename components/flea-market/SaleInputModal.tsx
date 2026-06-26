"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { getFleaMarketItemOptions } from "@/lib/btmFleaMarket";
import type { FleaMarketItem, FleaMarketItemOption } from "@/lib/btmFleaMarket";

interface SaleInputModalProps {
  items: FleaMarketItem[];
  onConfirm: (itemName: string, price: number, isCard: boolean, memo: string) => void;
  onClose: () => void;
  initialName?: string;
  initialPrice?: number;
  initialIsCard?: boolean;
  initialMemo?: string;
  title?: string;
}

export default function SaleInputModal({
  items,
  onConfirm,
  onClose,
  initialName = "",
  initialPrice,
  initialIsCard = false,
  initialMemo = "",
  title = "판매 입력",
}: SaleInputModalProps) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [itemName, setItemName] = useState(initialName);
  const [price, setPrice] = useState(initialPrice !== undefined ? String(initialPrice) : "");
  const [isCard, setIsCard] = useState(initialIsCard);
  const [memo, setMemo] = useState(initialMemo);
  const [options, setOptions] = useState<FleaMarketItemOption[]>([]);
  const [selectedOption, setSelectedOption] = useState("");

  const handleSelectItem = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedId(val);
    setSelectedOption("");
    setOptions([]);
    if (val === "") return;
    const found = items.find(i => String(i.id) === val);
    if (found) {
      setItemName(found.name);
      const opts = await getFleaMarketItemOptions(found.id);
      setOptions(opts);
      setPrice(opts.length > 0 ? "" : String(found.default_price));
    }
  };

  const handleConfirm = () => {
    if (!itemName.trim()) return alert("상품명을 입력해주세요.");
    if (options.length > 0 && !selectedOption) return alert("옵션을 선택해주세요.");
    const p = parseInt(price.replace(/,/g, ""));
    if (isNaN(p) || p < 0) return alert("금액을 입력해주세요.");
    onConfirm(itemName.trim(), p, isCard, memo.trim());
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

        {options.length > 0 && (
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontSize: "12px", color: "#888", marginBottom: "8px", fontWeight: 600 }}>옵션 선택</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {options.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setSelectedOption(opt.option_name);
                    setPrice(String(opt.price));
                    const found = items.find(i => String(i.id) === selectedId);
                    if (found) setItemName(`${found.name} - ${opt.option_name}`);
                  }}
                  style={{
                    padding: "8px 16px", borderRadius: "20px", fontSize: "14px", fontWeight: 500,
                    border: selectedOption === opt.option_name ? "2px solid #2563eb" : "2px solid #e5e5e5",
                    background: selectedOption === opt.option_name ? "#eff6ff" : "#f9f9f9",
                    color: selectedOption === opt.option_name ? "#1d4ed8" : "#444",
                    cursor: "pointer"
                  }}
                >
                  {opt.option_name} ({opt.price.toLocaleString()}원)
                </button>
              ))}
            </div>
          </div>
        )}

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

        {/* 결제 수단 */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", userSelect: "none" }}>
            <input
              type="checkbox"
              checked={isCard}
              onChange={e => setIsCard(e.target.checked)}
              style={{ width: "20px", height: "20px", borderRadius: "4px", accentColor: "#f97316", cursor: "pointer" }}
            />
            <span style={{ fontSize: "15px", color: "#444", fontWeight: 500 }}>💳 카드 결제</span>
            <span style={{ fontSize: "12px", color: "#bbb", marginLeft: "2px" }}>(체크 안 하면 현금)</span>
          </label>
        </div>

        {/* 비고 */}
        <div style={{ marginBottom: "24px" }}>
          <p style={{ fontSize: "12px", color: "#888", marginBottom: "8px", fontWeight: 600 }}>비고 <span style={{ fontWeight: 400, color: "#bbb" }}>(선택)</span></p>
          <input
            type="text"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="특이사항 입력"
            style={{
              width: "100%", padding: "12px 14px", borderRadius: "12px",
              border: "1.5px solid #e5e5e5", fontSize: "15px", color: "#111",
              outline: "none", background: "#f9f9f9", boxSizing: "border-box"
            }}
          />
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
