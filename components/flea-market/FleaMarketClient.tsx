"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings, Trash2, RefreshCw } from "lucide-react";
import SaleModal from "./SaleModal";
import LuckyDrawModal from "./LuckyDrawModal";
import ItemManager from "./ItemManager";
import {
  getFleaMarketItems,
  getOrCreateTodaySession,
  getTodaySales,
  recordSale,
  deleteSale,
} from "@/lib/btmFleaMarket";
import type { FleaMarketItem, FleaMarketSession, FleaMarketSale } from "@/lib/btmFleaMarket";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export default function FleaMarketClient() {
  const [items, setItems] = useState<FleaMarketItem[]>([]);
  const [session, setSession] = useState<FleaMarketSession | null>(null);
  const [sales, setSales] = useState<FleaMarketSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FleaMarketItem | { id: null; name: string; default_price: number } | null>(null);
  const [showLucky, setShowLucky] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemList, sess] = await Promise.all([
        getFleaMarketItems(),
        getOrCreateTodaySession(),
      ]);
      setItems(itemList);
      setSession(sess);
      const salesList = await getTodaySales(sess.id);
      setSales(salesList);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totalRevenue = sales.reduce((s, r) => s + r.price, 0);
  const cashRevenue = sales.filter(r => !r.is_card).reduce((s, r) => s + r.price, 0);
  const cardRevenue = sales.filter(r => r.is_card).reduce((s, r) => s + r.price, 0);

  const handleSaleConfirm = async (price: number, isCard: boolean) => {
    if (!session || !selectedItem) return;
    await recordSale({
      sessionId: session.id,
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      price,
      isCard,
    });
    setSelectedItem(null);
    const updated = await getTodaySales(session.id);
    setSales(updated);
  };

  const handleLuckyConfirm = async (count: number, price: number, luckyItem: string, isCard: boolean) => {
    if (!session) return;
    await recordSale({
      sessionId: session.id,
      itemId: null,
      itemName: `뽑기 ${count}회`,
      price,
      isCard,
      isLuckyDraw: true,
      luckyItem,
      luckyCount: count,
    });
    setShowLucky(false);
    const updated = await getTodaySales(session.id);
    setSales(updated);
  };

  const handleDeleteSale = async (id: number) => {
    if (!confirm("판매 기록을 삭제하시겠습니까?")) return;
    await deleteSale(id);
    if (session) {
      const updated = await getTodaySales(session.id);
      setSales(updated);
    }
  };

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh", color: "var(--text-secondary)", fontSize: "14px" }}>
      로딩 중...
    </div>
  );

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", paddingBottom: "40px" }}>
      {/* 헤더 */}
      <div style={{ padding: "20px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "4px" }}>플리마켓</h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
          </p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{ background: "none", border: "none", cursor: "pointer", color: showSettings ? "var(--text-accent)" : "var(--text-secondary)", padding: "4px" }}
        >
          <Settings size={22} />
        </button>
      </div>

      {/* 설정 (상품 관리) */}
      {showSettings && (
        <div style={{ margin: "0 16px 16px", borderRadius: "16px", background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <ItemManager items={items} onRefresh={() => { void load(); setShowSettings(false); }} />
        </div>
      )}

      {/* 매출 요약 */}
      <div style={{ margin: "0 16px 20px", padding: "16px", borderRadius: "16px", background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "6px" }}>오늘 총 매출</p>
        <p style={{ fontSize: "32px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "10px" }}>
          {totalRevenue.toLocaleString()}<span style={{ fontSize: "16px", marginLeft: "4px" }}>원</span>
        </p>
        <div style={{ display: "flex", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>💵 현금</span>
            <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>{cashRevenue.toLocaleString()}원</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>💳 카드</span>
            <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>{cardRevenue.toLocaleString()}원</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{sales.length}건</span>
          </div>
        </div>
      </div>

      {/* 상품 버튼 그리드 */}
      <div style={{ padding: "0 16px", marginBottom: "20px" }}>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "12px" }}>상품 선택</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              style={{
                padding: "18px 12px", borderRadius: "16px", background: "var(--surface-1)",
                border: "1.5px solid var(--border)", cursor: "pointer", textAlign: "left",
                transition: "border-color 0.15s"
              }}
            >
              <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "4px" }}>{item.name}</p>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>{item.default_price.toLocaleString()}원</p>
            </button>
          ))}

          {/* 기타 */}
          <button
            onClick={() => setSelectedItem({ id: null, name: "기타", default_price: 0 })}
            style={{
              padding: "18px 12px", borderRadius: "16px", background: "var(--surface-1)",
              border: "1.5px solid var(--border)", cursor: "pointer", textAlign: "left"
            }}
          >
            <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "4px" }}>기타 품목</p>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>직접 입력</p>
          </button>

          {/* 뽑기 */}
          <button
            onClick={() => setShowLucky(true)}
            style={{
              padding: "18px 12px", borderRadius: "16px", background: "var(--bg-accent)",
              border: "1.5px solid var(--border-accent)", cursor: "pointer", textAlign: "left"
            }}
          >
            <p style={{ fontSize: "15px", fontWeight: 500, color: "var(--text-accent)", marginBottom: "4px" }}>🎰 뽑기</p>
            <p style={{ fontSize: "14px", color: "var(--text-accent)" }}>1회 2,000원</p>
          </button>
        </div>
      </div>

      {/* 판매 내역 */}
      <div style={{ padding: "0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>판매 내역 ({sales.length}건)</p>
          <button onClick={() => void load()} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)" }}>
            <RefreshCw size={14} />
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {sales.length === 0 && (
            <p style={{ textAlign: "center", padding: "24px", color: "var(--text-secondary)", fontSize: "13px" }}>아직 판매 내역이 없습니다.</p>
          )}
          {sales.map(sale => (
            <div key={sale.id} style={{
              display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px",
              borderRadius: "12px", background: "var(--surface-1)", border: "1px solid var(--border)"
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>
                    {sale.item_name}
                  </span>
                  {sale.is_lucky_draw && sale.lucky_item && (
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)", background: "var(--surface-0)", padding: "1px 6px", borderRadius: "8px" }}>
                      → {sale.lucky_item}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{formatTime(sale.sold_at)}</span>
                  <span style={{ fontSize: "11px", color: sale.is_card ? "var(--text-accent)" : "var(--text-secondary)" }}>
                    {sale.is_card ? "카드" : "현금"}
                  </span>
                </div>
              </div>
              <span style={{ fontSize: "16px", fontWeight: 500, color: "var(--text-primary)" }}>
                {sale.price.toLocaleString()}원
              </span>
              <button onClick={() => handleDeleteSale(sale.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", padding: "4px" }}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 판매 팝업 */}
      {selectedItem && (
        <SaleModal
          item={selectedItem}
          onConfirm={handleSaleConfirm}
          onClose={() => setSelectedItem(null)}
        />
      )}

      {/* 뽑기 팝업 */}
      {showLucky && (
        <LuckyDrawModal
          items={items}
          onConfirm={handleLuckyConfirm}
          onClose={() => setShowLucky(false)}
        />
      )}
    </div>
  );
}
