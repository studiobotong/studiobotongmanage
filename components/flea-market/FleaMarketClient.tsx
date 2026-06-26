"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings, Trash2, RefreshCw, X } from "lucide-react";
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

const S = {
  page: { minHeight: "100vh", background: "#f5f5f5", maxWidth: "480px", margin: "0 auto" } as React.CSSProperties,
  header: { background: "#fff", padding: "16px 20px", borderBottom: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", alignItems: "center" } as React.CSSProperties,
  headerTitle: { fontSize: "20px", fontWeight: 600, color: "#111" } as React.CSSProperties,
  headerDate: { fontSize: "13px", color: "#888", marginTop: "2px" } as React.CSSProperties,
  settingsBtn: { display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", background: "#f0f0f0", border: "none", cursor: "pointer", fontSize: "14px", color: "#444", fontWeight: 500 } as React.CSSProperties,
  summaryCard: { margin: "12px 16px", padding: "16px 20px", borderRadius: "16px", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" } as React.CSSProperties,
  summaryLabel: { fontSize: "12px", color: "#888", marginBottom: "4px" } as React.CSSProperties,
  summaryAmount: { fontSize: "36px", fontWeight: 700, color: "#111" } as React.CSSProperties,
  summaryUnit: { fontSize: "18px", fontWeight: 400, marginLeft: "4px", color: "#666" } as React.CSSProperties,
  summaryRow: { display: "flex", gap: "16px", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #f0f0f0" } as React.CSSProperties,
  summaryItem: { display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#555" } as React.CSSProperties,
  sectionLabel: { fontSize: "12px", fontWeight: 600, color: "#888", marginBottom: "10px", letterSpacing: "0.5px" } as React.CSSProperties,
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" } as React.CSSProperties,
  itemBtn: { padding: "20px 16px", borderRadius: "16px", background: "#fff", border: "1.5px solid #e5e5e5", cursor: "pointer", textAlign: "left" as const, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  itemBtnName: { fontSize: "16px", fontWeight: 600, color: "#111", marginBottom: "4px" } as React.CSSProperties,
  itemBtnPrice: { fontSize: "15px", color: "#666" } as React.CSSProperties,
  luckyBtn: { padding: "20px 16px", borderRadius: "16px", background: "#fff7ed", border: "1.5px solid #fdba74", cursor: "pointer", textAlign: "left" as const, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  luckyBtnName: { fontSize: "16px", fontWeight: 600, color: "#c2410c", marginBottom: "4px" } as React.CSSProperties,
  luckyBtnPrice: { fontSize: "15px", color: "#ea580c" } as React.CSSProperties,
  salesHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" } as React.CSSProperties,
  saleRow: { display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", borderRadius: "12px", background: "#fff", border: "1px solid #f0f0f0", marginBottom: "8px" } as React.CSSProperties,
  saleRowName: { fontSize: "15px", fontWeight: 500, color: "#111", marginBottom: "2px" } as React.CSSProperties,
  saleRowSub: { fontSize: "12px", color: "#aaa" } as React.CSSProperties,
  saleRowPrice: { fontSize: "16px", fontWeight: 600, color: "#111" } as React.CSSProperties,
  deleteBtn: { background: "none", border: "none", cursor: "pointer", color: "#ccc", padding: "4px" } as React.CSSProperties,
};

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
      const [itemList, sess] = await Promise.all([getFleaMarketItems(), getOrCreateTodaySession()]);
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
    await recordSale({ sessionId: session.id, itemId: selectedItem.id, itemName: selectedItem.name, price, isCard });
    setSelectedItem(null);
    setSales(await getTodaySales(session.id));
  };

  const handleLuckyConfirm = async (count: number, price: number, luckyItem: string, isCard: boolean) => {
    if (!session) return;
    await recordSale({ sessionId: session.id, itemId: null, itemName: `뽑기 ${count}회`, price, isCard, isLuckyDraw: true, luckyItem, luckyCount: count });
    setShowLucky(false);
    setSales(await getTodaySales(session.id));
  };

  const handleDeleteSale = async (id: number) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await deleteSale(id);
    if (session) setSales(await getTodaySales(session.id));
  };

  if (loading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh", color: "#888", fontSize: "14px" }}>로딩 중...</div>;

  return (
    <div style={S.page}>
      {/* 헤더 */}
      <div style={S.header}>
        <div>
          <div style={S.headerTitle}>🛍️ 플리마켓</div>
          <div style={S.headerDate}>{new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}</div>
        </div>
        <button style={S.settingsBtn} onClick={() => setShowSettings(true)}>
          <Settings size={16} /> 상품 관리
        </button>
      </div>

      <div style={{ padding: "0 0 40px" }}>
        {/* 매출 요약 */}
        <div style={S.summaryCard}>
          <div style={S.summaryLabel}>오늘 총 매출</div>
          <div style={S.summaryAmount}>{totalRevenue.toLocaleString()}<span style={S.summaryUnit}>원</span></div>
          <div style={S.summaryRow}>
            <div style={S.summaryItem}>💵 현금 <strong>{cashRevenue.toLocaleString()}원</strong></div>
            <div style={S.summaryItem}>💳 카드 <strong>{cardRevenue.toLocaleString()}원</strong></div>
            <div style={{ ...S.summaryItem, marginLeft: "auto" }}><strong>{sales.length}건</strong></div>
          </div>
        </div>

        {/* 상품 버튼 */}
        <div style={{ padding: "16px 16px 8px" }}>
          <div style={S.sectionLabel}>상품 선택</div>
          <div style={S.grid}>
            {items.map(item => (
              <button key={item.id} style={S.itemBtn} onClick={() => setSelectedItem(item)}>
                <div style={S.itemBtnName}>{item.name}</div>
                <div style={S.itemBtnPrice}>{item.default_price.toLocaleString()}원</div>
              </button>
            ))}
            <button style={S.itemBtn} onClick={() => setSelectedItem({ id: null, name: "기타", default_price: 0 })}>
              <div style={S.itemBtnName}>기타 품목</div>
              <div style={S.itemBtnPrice}>직접 입력</div>
            </button>
            <button style={S.luckyBtn} onClick={() => setShowLucky(true)}>
              <div style={S.luckyBtnName}>🎰 뽑기</div>
              <div style={S.luckyBtnPrice}>1회 2,000원</div>
            </button>
          </div>
        </div>

        {/* 판매 내역 */}
        <div style={{ padding: "8px 16px" }}>
          <div style={S.salesHeader}>
            <div style={S.sectionLabel}>판매 내역 ({sales.length}건)</div>
            <button onClick={() => void load()} style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa" }}>
              <RefreshCw size={14} />
            </button>
          </div>
          {sales.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px", color: "#bbb", fontSize: "14px" }}>아직 판매 내역이 없습니다.</div>
          ) : (
            sales.map(sale => (
              <div key={sale.id} style={S.saleRow}>
                <div style={{ flex: 1 }}>
                  <div style={S.saleRowName}>
                    {sale.item_name}
                    {sale.lucky_item && <span style={{ fontSize: "12px", color: "#888", marginLeft: "6px" }}>→ {sale.lucky_item}</span>}
                  </div>
                  <div style={S.saleRowSub}>
                    {formatTime(sale.sold_at)} · {sale.is_card ? "💳 카드" : "💵 현금"}
                  </div>
                </div>
                <div style={S.saleRowPrice}>{sale.price.toLocaleString()}원</div>
                <button style={S.deleteBtn} onClick={() => handleDeleteSale(sale.id)}><Trash2 size={15} /></button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 상품 관리 모달 */}
      {showSettings && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "flex-end" }}
          onClick={() => setShowSettings(false)}>
          <div style={{ width: "100%", background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 0" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 600, color: "#111" }}>상품 관리</h3>
              <button onClick={() => setShowSettings(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}><X size={22} /></button>
            </div>
            <ItemManager items={items} onRefresh={() => { void load(); }} />
          </div>
        </div>
      )}

      {selectedItem && <SaleModal item={selectedItem} onConfirm={handleSaleConfirm} onClose={() => setSelectedItem(null)} />}
      {showLucky && <LuckyDrawModal items={items} onConfirm={handleLuckyConfirm} onClose={() => setShowLucky(false)} />}
    </div>
  );
}
