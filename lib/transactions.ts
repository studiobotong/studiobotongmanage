/**
 * lib/transactions.ts
 *
 * asset_transactions 테이블에 대한 CRUD 함수 모음.
 * Supabase 클라이언트는 lib/supabaseClient.ts 에서 가져옵니다.
 *
 * ─────────────────────────────────────────
 *  함수 목록
 * ─────────────────────────────────────────
 *  getTransactions()       전체 조회 (최신 순)
 *  getTransactionById()    단건 조회
 *  insertTransaction()     단건 insert
 *  bulkInsertTransactions()  중복 방지 bulk insert
 *  updateTransaction()     수정
 *  deleteTransaction()     삭제
 *  testInsert()            테스트용 insert (개발 확인용)
 */

import { supabase } from "./supabaseClient";
import type { AssetTransaction, AssetTransactionInsert } from "@/types/transactions";

// ─────────────────────────────────────────────────────────────
// 1. 조회 (SELECT)
// ─────────────────────────────────────────────────────────────

/**
 * 전체 거래 내역을 거래일 내림차순으로 반환합니다.
 */
export async function getTransactions(): Promise<AssetTransaction[]> {
  const { data, error } = await supabase
    .from("asset_transactions")
    .select("*")
    .order("trade_date", { ascending: false });

  if (error) {
    console.error("[getTransactions] 오류:", error.message);
    throw new Error(error.message);
  }

  return (data ?? []) as AssetTransaction[];
}

/**
 * id로 단건 조회합니다.
 * 존재하지 않으면 null을 반환합니다.
 */
export async function getTransactionById(
  id: string
): Promise<AssetTransaction | null> {
  const { data, error } = await supabase
    .from("asset_transactions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    console.error("[getTransactionById] 오류:", error.message);
    throw new Error(error.message);
  }

  return data as AssetTransaction;
}

// ─────────────────────────────────────────────────────────────
// 2. 단건 INSERT
// ─────────────────────────────────────────────────────────────

/**
 * 거래 1건을 insert하고 저장된 레코드를 반환합니다.
 *
 * @example
 * const tx = await insertTransaction({
 *   trade_date: new Date().toISOString(),
 *   type: "BUY",
 *   name: "삼성전자",
 *   symbol: "005930",
 *   market: "KRX",
 *   currency: "KRW",
 *   quantity: 10,
 *   unit_price: 75000,
 *   total_amount: 750000,
 *   fee: null,
 *   memo: null,
 * });
 */
export async function insertTransaction(
  tx: AssetTransactionInsert
): Promise<AssetTransaction> {
  const { data, error } = await supabase
    .from("asset_transactions")
    .insert(tx)
    .select()
    .single();

  if (error) {
    console.error("[insertTransaction] 오류:", error.message);
    throw new Error(error.message);
  }

  return data as AssetTransaction;
}

// ─────────────────────────────────────────────────────────────
// 3. 중복 방지 Bulk INSERT
// ─────────────────────────────────────────────────────────────

/**
 * 여러 거래를 한 번에 insert합니다.
 * trade_date + type + symbol + quantity + unit_price 조합이 동일하면 스킵합니다.
 *
 * @returns { inserted: 실제 저장 건수, skipped: 중복으로 스킵된 건수 }
 */
export async function bulkInsertTransactions(
  rows: AssetTransactionInsert[]
): Promise<{ inserted: number; skipped: number }> {
  if (rows.length === 0) return { inserted: 0, skipped: 0 };

  // ① 기존 레코드에서 중복 키 목록 가져오기
  const { data: existing, error: fetchError } = await supabase
    .from("asset_transactions")
    .select("trade_date, type, symbol, quantity, unit_price");

  if (fetchError) {
    console.error("[bulkInsertTransactions] 조회 오류:", fetchError.message);
    throw new Error(fetchError.message);
  }

  type DupKey = {
    trade_date: string;
    type: string;
    symbol: string;
    quantity: number;
    unit_price: number;
  };

  const existingSet = new Set(
    (existing ?? []).map(
      (r: DupKey) =>
        `${r.trade_date}|${r.type}|${r.symbol}|${r.quantity}|${r.unit_price}`
    )
  );

  // ② 중복 제거
  const toInsert = rows.filter(
    (r) =>
      !existingSet.has(
        `${r.trade_date}|${r.type}|${r.symbol}|${r.quantity}|${r.unit_price}`
      )
  );

  const skipped = rows.length - toInsert.length;

  if (toInsert.length === 0) {
    console.log(`[bulkInsertTransactions] 전체 중복 스킵 (${skipped}건)`);
    return { inserted: 0, skipped };
  }

  // ③ insert
  const { error: insertError } = await supabase
    .from("asset_transactions")
    .insert(toInsert);

  if (insertError) {
    console.error("[bulkInsertTransactions] insert 오류:", insertError.message);
    throw new Error(insertError.message);
  }

  console.log(
    `[bulkInsertTransactions] 저장 ${toInsert.length}건, 스킵 ${skipped}건`
  );
  return { inserted: toInsert.length, skipped };
}

// ─────────────────────────────────────────────────────────────
// 4. UPDATE
// ─────────────────────────────────────────────────────────────

/**
 * id에 해당하는 거래를 수정하고 업데이트된 레코드를 반환합니다.
 */
export async function updateTransaction(
  id: string,
  patch: Partial<AssetTransactionInsert>
): Promise<AssetTransaction> {
  const { data, error } = await supabase
    .from("asset_transactions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[updateTransaction] 오류:", error.message);
    throw new Error(error.message);
  }

  return data as AssetTransaction;
}

// ─────────────────────────────────────────────────────────────
// 5. DELETE
// ─────────────────────────────────────────────────────────────

/**
 * id에 해당하는 거래를 삭제합니다.
 */
export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from("asset_transactions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[deleteTransaction] 오류:", error.message);
    throw new Error(error.message);
  }
}

// ─────────────────────────────────────────────────────────────
// 6. 테스트 함수 (개발 확인용)
// ─────────────────────────────────────────────────────────────

/**
 * 테스트 데이터 1건을 insert하고 결과를 console.log로 출력합니다.
 *
 * 사용 예시 (브라우저 콘솔 또는 서버 액션에서):
 *   import { testInsert } from "@/lib/transactions";
 *   await testInsert();
 */
export async function testInsert(): Promise<void> {
  console.log("━━━ [testInsert] 시작 ━━━");

  const payload: AssetTransactionInsert = {
    trade_date: new Date().toISOString(),
    type: "BUY",
    name: "테스트",
    symbol: "TEST",
    market: "ETC",
    currency: "KRW",
    quantity: 1,
    unit_price: 1000,
    total_amount: 1000,
    fee: null,
    memo: "supabase 연결 테스트",
  };

  console.log("▶ insert 데이터:", payload);

  try {
    const inserted = await insertTransaction(payload);
    console.log("✅ insert 성공:", inserted);
  } catch (err) {
    console.error("❌ insert 실패:", err);
    return;
  }

  // 전체 조회 확인
  try {
    const all = await getTransactions();
    console.log(`✅ 전체 조회 성공: ${all.length}건`);
    console.log("  최신 1건:", all[0]);
  } catch (err) {
    console.error("❌ 조회 실패:", err);
  }

  console.log("━━━ [testInsert] 완료 ━━━");
}
