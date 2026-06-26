"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Pencil, Trash2, RefreshCw } from "lucide-react";
import SaleInputModal from "./SaleInputModal";
import LuckyDrawModal from "./LuckyDrawModal";
import EditSaleModal from "./EditSaleModal";
import ItemManager from "./ItemManager";
import {
  getFleaMarketItems,
  getAllFleaMarketItemOptions,
  getOrCreateTodaySession,
  getSessionByDate,
  getSessionDates,
  getTodaySales,
  recordSale,
  deleteSale,
  updateSale,
} from "@/lib/btmFleaMarket";
import type { FleaMarketItem, FleaMarketItemOption, FleaMarketSession, FleaMarketSale } from "@/lib/btmFleaMarket";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function FleaMarketClient() {
  const [items, setItems] = useState<FleaMarketItem[]>([]);
  const [optionsMap, setOptionsMap] = useState<Record<number, FleaMarketItemOption[]>>({});
  const [session, setSession] = useState<FleaMarketSession | null>(null);
  const [sales, setSales] = useState<FleaMarketSale[]>([]);
  const [sessionDates, setSessionDates] = useState<{ id: number; date: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);

  const [showSettings, setShowSettings] = useState(false);
  const [showSaleInput, setShowSaleInput] = useState(false);
  const [showLucky, setShowLucky] = useState(false);
  const [editingSale, setEditingSale] = useState<FleaMarketSale | null>(null);

  const loadItems = useCallback(async () => {
    const [itemList, opts] = await Promise.all([
      getFleaMarketItems(),
      getAllFleaMarketItemOptions(),
    ]);
    setItems(itemList);
    setOptionsMap(opts);
  }, []);

  const loadDates = useCallback(async () => {
    const dates = await getSessionDates();
    setSessionDates(dates);
  }, []);

  const loadSalesForDate = useCallback(async (date: string) => {
    setLoading(true);
    try {
      let sess: FleaMarketSession | null;
      if (date === todayStr()) {
        sess = await getOrCreateTodaySession();
      } else {
        sess = await getSessionByDate(date);
      }
      setSession(sess);
      if (sess) {
        setSales(await getTodaySales(sess.id));
      } else {
        setSales([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
    void loadDates();
    void loadSalesForDate(selectedDate);
  }, [loadItems, loadDates, loadSalesForDate, selectedDate]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
  };

  const totalRevenue = sales.reduce((s, r) => s + r.price, 0);
  const cashRevenue = sales.filter(r => !r.is_card).reduce((s, r) => s + r.price, 0);
  const cardRevenue = sales.filter(r => r.is_card).reduce((s, r) => s + r.price, 0);

  const handleSaleConfirm = async (itemName: string, price: number, isCard: boolean, memo: string) => {
    if (!session) return;
    await recordSale({ sessionId: session.id, itemId: null, itemName, price, isCard, memo: memo || undefined });
    setShowSaleInput(false);
    setSales(await getTodaySales(session.id));
    await loadDates();
  };

  const handleLuckyConfirm = async (count: number, price: number, luckyItem: string, isCard: boolean) => {
    if (!session) return;
    await recordSale({ sessionId: session.id, itemId: null, itemName: `뽑기 ${count}회`, price, isCard, isLuckyDraw: true, luckyItem, luckyCount: count });
    setShowLucky(false);
    setSales(await getTodaySales(session.id));
    await loadDates();
  };

  const handleEditConfirm = async (itemName: string, price: number, isCard: boolean, memo: string) => {
    if (!editingSale || !session) return;
    await updateSale(editingSale.id, { itemName, price, isCard, memo: memo || undefined });
    setEditingSale(null);
    setSales(await getTodaySales(session.id));
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 판매 기록을 삭제하시겠습니까?")) return;
    await deleteSale(id);
    if (session) setSales(await getTodaySales(session.id));
  };

  const dateOptions = (() => {
    const today = todayStr();
    const fromDB = sessionDates.map(s => s.date);
    const all = Array.from(new Set([today, ...fromDB])).sort((a, b) => b.localeCompare(a));
    return all;
  })();

  const formatDateLabel = (d: string) => {
    const date = new Date(d);
    const today = todayStr();
    const prefix = d === today ? "오늘 " : "";
    return prefix + date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", maxWidth: "480px", margin: "0 auto" }}>

      <div style={{ background: "#fff", padding: "16px 20px", borderBottom: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "20px", fontWeight: 700, color: "#111" }}>🛍️ 플리마켓</div>
        <button onClick={() => setShowSettings(true)}
          style={{ padding: "8px 14px", borderRadius: "10px", background: "#f0f0f0", border: "none", cursor: "pointer", fontSize: "14px", color: "#444", fontWeight: 500 }}>
          상품 관리
        </button>
      </div>

      <div style={{ padding: "0 0 60px" }}>

        <div style={{ padding: "12px 16px 0" }}>
          <select
            value={selectedDate}
            onChange={e => handleDateChange(e.target.value)}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: "12px",
              border: "1.5px solid #e5e5e5", background: "#fff",
              fontSize: "15px", fontWeight: 600, color: "#111", outline: "none",
              appearance: "none", WebkitAppearance: "none",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
            }}
          >
            {dateOptions.map(d => (
              <option key={d} value={d}>{formatDateLabel(d)}</option>
            ))}
          </select>
        </div>

        <div style={{ margin: "12px 16px", padding: "16px 20px", borderRadius: "16px", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "4px", fontWeight: 600 }}>총 매출</div>
          <div style={{ fontSize: "36px", fontWeight: 700, color: "#111" }}>
            {totalRevenue.toLocaleString()}<span style={{ fontSize: "18px", fontWeight: 400, marginLeft: "4px", color: "#666" }}>원</span>
          </div>
          <div style={{ display: "flex", gap: "16px", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #f0f0f0" }}>
            <span style={{ fontSize: "14px", color: "#555" }}>💵 현금 <strong>{cashRevenue.toLocaleString()}원</strong></span>
            <span style={{ fontSize: "14px", color: "#555" }}>💳 카드 <strong>{cardRevenue.toLocaleString()}원</strong></span>
            <span style={{ fontSize: "14px", color: "#888", marginLeft: "auto" }}><strong>{sales.length}건</strong></span>
          </div>
        </div>

        <div style={{ padding: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "16px" }}>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              padding: "18px 8px", borderRadius: "16px", background: "#fff",
              border: "1.5px solid #e5e5e5", cursor: "pointer", textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "6px" }}>⭐</div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#111" }}>상품추가</div>
            <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>즐겨찾기</div>
          </button>

          <button
            onClick={() => { if (session) setShowSaleInput(true); }}
            style={{
              padding: "18px 8px", borderRadius: "16px", background: "#dcfce7",
              border: "1.5px solid #86efac", cursor: "pointer", textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "6px" }}>🛒</div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#15803d" }}>판매입력</div>
            <div style={{ fontSize: "11px", color: "#16a34a", marginTop: "2px" }}>즐겨찾기 연동</div>
          </button>

          <button
            onClick={() => { if (session) setShowLucky(true); }}
            style={{
              padding: "18px 8px", borderRadius: "16px", background: "#fff7ed",
              border: "1.5px solid #fdba74", cursor: "pointer", textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "6px" }}>🎰</div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#c2410c" }}>뽑기</div>
            <div style={{ fontSize: "11px", color: "#ea580c", marginTop: "2px" }}>2,000원</div>
          </button>
        </div>

        <div style={{ padding: "0 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#888" }}>판매 내역 ({sales.length}건)</div>
            <button onClick={() => void loadSalesForDate(selectedDate)} style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb" }}>
              <RefreshCw size={14} />
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "24px", color: "#bbb", fontSize: "14px" }}>로딩 중...</div>
          ) : sales.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px", color: "#bbb", fontSize: "14px" }}>판매 내역이 없습니다.</div>
          ) : (
            sales.map(sale => (
              <div key={sale.id} style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px",
                borderRadius: "12px", background: "#fff", border: "1px solid #f0f0f0",
                marginBottom: "8px", boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: "#111", marginBottom: "3px" }}>
                    {sale.item_name}
                    {sale.lucky_item && (
                      <span style={{ fontSize: "12px", color: "#888", marginLeft: "6px", fontWeight: 400 }}>→ {sale.lucky_item}</span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: "#aaa" }}>
                    {formatDateTime(sale.sold_at)} · {sale.is_card ? "💳 카드" : "💵 현금"}
                  </div>
                </div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#111" }}>{sale.price.toLocaleString()}원</div>
                <button onClick={() => setEditingSale(sale)} style={{ background: "none", border: "none", cursor: "pointer", color: "#bbb", padding: "4px" }}>
                  <Pencil size={15} />
                </button>
                <button onClick={() => handleDelete(sale.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e5e5e5", padding: "4px" }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {showSettings && (
        <div onClick={() => { setShowSettings(false); void loadItems(); }}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "flex-end" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: "100%", background: "#fff", borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 0" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#111" }}>⭐ 상품 즐겨찾기</h3>
              <button onClick={() => { setShowSettings(false); void loadItems(); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}><X size={22} /></button>
            </div>
            <ItemManager items={items} onRefresh={() => { void loadItems(); }} />
          </div>
        </div>
      )}

      {showSaleInput && (
        <SaleInputModal
          items={items}
          onConfirm={handleSaleConfirm}
          onClose={() => setShowSaleInput(false)}
        />
      )}

      {showLucky && (
        <LuckyDrawModal
          items={items}
          optionsMap={optionsMap}
          onConfirm={handleLuckyConfirm}
          onClose={() => setShowLucky(false)}
        />
      )}

      {editingSale && (
        <EditSaleModal
          sale={editingSale}
          items={items}
          onConfirm={handleEditConfirm}
          onClose={() => setEditingSale(null)}
        />
      )}
    </div>
  );
}
