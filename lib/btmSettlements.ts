/**
 * BTM 정산내역 저장 함수
 * SellerDailySettle 파싱 결과 → btm_settlements 저장
 */

import { btmSupabase } from "./btmSupabaseClient";
import type { ParsedSettlementRow } from "./settlementParser";

export interface SettlementUploadResult {
  upserted: number;   // 신규 + 업데이트
  skipped: number;    // 동일 데이터 스킵
  totalRows: number;
  elapsedMs: number;
  month: string;
  errors: string[];
}

export async function processBTMSettlementUpload(
  rows: ParsedSettlementRow[],
  month: string
): Promise<SettlementUploadResult> {
  const started = Date.now();
  const result: SettlementUploadResult = {
    upserted: 0,
    skipped: 0,
    totalRows: rows.length,
    elapsedMs: 0,
    month,
    errors: [],
  };

  for (const row of rows) {
    const payload = {
      settlement_month: row.settlement_date.slice(0, 7), // YYYY-MM
      settlement_date: row.settlement_date,
      completed_date: row.completed_date,
      settlement_amount: row.settlement_amount,
      normal_amount: row.normal_amount,
      quick_amount: row.quick_amount,
      base_amount: row.base_amount,
      fee_total: row.fee_total,
      benefit_settlement: row.benefit_settlement,
      daily_deduction: row.daily_deduction,
      payment_hold: row.payment_hold,
      minus_wallet: row.minus_wallet,
      return_care_fee: row.return_care_fee,
      preferential_fee_refund: row.preferential_fee_refund,
      settlement_method: row.settlement_method,
      raw_data: row.raw_data,
    };

    // settlement_date 기준 upsert
    const { error } = await btmSupabase
      .from("btm_settlements")
      .upsert(payload, { onConflict: "settlement_date" });

    if (error) {
      result.errors.push(
        `${row.settlement_date}: 저장 실패 — ${error.message}`
      );
      continue;
    }

    result.upserted += 1;
  }

  result.elapsedMs = Date.now() - started;
  return result;
}

/** 월별 정산 요약 조회 */
export async function getBTMSettlementSummary(
  from: string, // YYYY-MM
  to: string    // YYYY-MM
): Promise<{
  totalBaseAmount: number;
  totalFee: number;
  totalSettlement: number;
  totalBenefit: number;
  rowCount: number;
}> {
  const { data, error } = await btmSupabase
    .from("btm_settlements")
    .select("base_amount, fee_total, settlement_amount, benefit_settlement")
    .gte("settlement_month", from)
    .lte("settlement_month", to);

  if (error || !data) {
    return { totalBaseAmount: 0, totalFee: 0, totalSettlement: 0, totalBenefit: 0, rowCount: 0 };
  }

  return {
    totalBaseAmount: data.reduce((s, r) => s + (r.base_amount ?? 0), 0),
    totalFee: data.reduce((s, r) => s + (r.fee_total ?? 0), 0),
    totalSettlement: data.reduce((s, r) => s + (r.settlement_amount ?? 0), 0),
    totalBenefit: data.reduce((s, r) => s + (r.benefit_settlement ?? 0), 0),
    rowCount: data.length,
  };
}
