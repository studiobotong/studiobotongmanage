import { btmSupabase } from "./btmSupabaseClient";

// ── 타입 ──────────────────────────────────────────────────────────

export interface FleaMarketItem {
  id: number;
  name: string;
  default_price: number;
  sort_order: number;
  is_active: boolean;
}

export interface FleaMarketSession {
  id: number;
  date: string;
  location: string | null;
  memo: string | null;
  created_at: string;
}

export interface FleaMarketSale {
  id: number;
  session_id: number | null;
  item_id: number | null;
  item_name: string;
  price: number;
  is_card: boolean;
  is_lucky_draw: boolean;
  lucky_item: string | null;
  lucky_count: number;
  memo: string | null;
  sold_at: string;
}

// ── 상품 관리 ─────────────────────────────────────────────────────

export async function getFleaMarketItems(): Promise<FleaMarketItem[]> {
  const { data, error } = await btmSupabase
    .from("btm_flea_market_items")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FleaMarketItem[];
}

export async function getAllFleaMarketItems(): Promise<FleaMarketItem[]> {
  const { data, error } = await btmSupabase
    .from("btm_flea_market_items")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FleaMarketItem[];
}

export async function createFleaMarketItem(
  name: string,
  defaultPrice: number,
  sortOrder: number
): Promise<void> {
  const { error } = await btmSupabase
    .from("btm_flea_market_items")
    .insert({ name, default_price: defaultPrice, sort_order: sortOrder });
  if (error) throw error;
}

export async function updateFleaMarketItem(
  id: number,
  name: string,
  defaultPrice: number,
  isActive: boolean
): Promise<void> {
  const { error } = await btmSupabase
    .from("btm_flea_market_items")
    .update({ name, default_price: defaultPrice, is_active: isActive })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteFleaMarketItem(id: number): Promise<void> {
  const { error } = await btmSupabase
    .from("btm_flea_market_items")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ── 회차 관리 ─────────────────────────────────────────────────────

export async function getTodaySession(): Promise<FleaMarketSession | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await btmSupabase
    .from("btm_flea_market_sessions")
    .select("*")
    .eq("date", today)
    .maybeSingle();
  if (error) throw error;
  return data as FleaMarketSession | null;
}

export async function createSession(
  date: string,
  location?: string
): Promise<FleaMarketSession> {
  const { data, error } = await btmSupabase
    .from("btm_flea_market_sessions")
    .insert({ date, location: location ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as FleaMarketSession;
}

export async function getOrCreateTodaySession(): Promise<FleaMarketSession> {
  const existing = await getTodaySession();
  if (existing) return existing;
  const today = new Date().toISOString().slice(0, 10);
  return createSession(today);
}

// ── 판매 내역 ─────────────────────────────────────────────────────

export async function getTodaySales(sessionId: number): Promise<FleaMarketSale[]> {
  const { data, error } = await btmSupabase
    .from("btm_flea_market_sales")
    .select("*")
    .eq("session_id", sessionId)
    .order("sold_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FleaMarketSale[];
}

export async function recordSale(params: {
  sessionId: number;
  itemId: number | null;
  itemName: string;
  price: number;
  isCard: boolean;
  isLuckyDraw?: boolean;
  luckyItem?: string;
  luckyCount?: number;
  memo?: string;
}): Promise<void> {
  const { error } = await btmSupabase
    .from("btm_flea_market_sales")
    .insert({
      session_id: params.sessionId,
      item_id: params.itemId,
      item_name: params.itemName,
      price: params.price,
      is_card: params.isCard,
      is_lucky_draw: params.isLuckyDraw ?? false,
      lucky_item: params.luckyItem ?? null,
      lucky_count: params.luckyCount ?? 1,
      memo: params.memo ?? null,
      sold_at: new Date().toISOString(),
    });
  if (error) throw error;
}

export async function deleteSale(id: number): Promise<void> {
  const { error } = await btmSupabase
    .from("btm_flea_market_sales")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/** 판매 내역이 있는 날짜 목록 조회 */
export async function getSessionDates(): Promise<{ id: number; date: string }[]> {
  const { data, error } = await btmSupabase
    .from("btm_flea_market_sessions")
    .select("id, date")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as { id: number; date: string }[];
}

/** 특정 날짜의 session 조회 (없으면 null) */
export async function getSessionByDate(date: string): Promise<FleaMarketSession | null> {
  const { data, error } = await btmSupabase
    .from("btm_flea_market_sessions")
    .select("*")
    .eq("date", date)
    .maybeSingle();
  if (error) throw error;
  return data as FleaMarketSession | null;
}

/** 판매 내역 수정 */
export async function updateSale(
  id: number,
  params: {
    itemName: string;
    price: number;
    isCard: boolean;
    memo?: string;
  }
): Promise<void> {
  const { error } = await btmSupabase
    .from("btm_flea_market_sales")
    .update({
      item_name: params.itemName,
      price: params.price,
      is_card: params.isCard,
      memo: params.memo ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}
