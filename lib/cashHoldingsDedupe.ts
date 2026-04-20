/**
 * 예수금(KRW_CASH / USD_CASH)은 계좌당·기준일·유형당 1행이어야 합니다.
 * 중복 행이 있으면 목록/합계에서 evaluated_amount가 그대로 더해져 2배(또는 그 이상)로 보입니다.
 */

import { supabase } from "./supabaseClient";
import type { AssetSnapshotHolding } from "@/types/assets";

const CASH_TYPES = new Set(["KRW_CASH", "USD_CASH"]);

export function hasCashDuplicateRows(holdings: AssetSnapshotHolding[]): boolean {
  const counts = new Map<string, number>();
  for (const h of holdings) {
    if (!CASH_TYPES.has(h.asset_type ?? "")) continue;
    const acc = (h.account ?? "").trim();
    if (!acc) continue;
    const key = `${h.snapshot_date}|${h.asset_type}|${acc}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const n of counts.values()) {
    if (n > 1) return true;
  }
  return false;
}

/**
 * 동일 (snapshot_date, asset_type, account) 예수금 행 중 1건만 남기고 나머지를 삭제합니다.
 * 유지 행: evaluated_amount가 가장 큰 것, 동률이면 id 문자열이 더 큰 것(보통 최근 insert).
 * @returns 삭제한 행 수
 */
export async function deleteDuplicateCashHoldings(
  holdings: AssetSnapshotHolding[]
): Promise<number> {
  const groups = new Map<string, AssetSnapshotHolding[]>();
  for (const h of holdings) {
    if (!CASH_TYPES.has(h.asset_type ?? "")) continue;
    const acc = (h.account ?? "").trim();
    if (!acc) continue;
    const key = `${h.snapshot_date}|${h.asset_type}|${acc}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(h);
  }

  const idsToDelete: string[] = [];
  for (const [, rows] of groups) {
    if (rows.length <= 1) continue;
    rows.sort((a, b) => {
      if (b.evaluated_amount !== a.evaluated_amount) {
        return b.evaluated_amount - a.evaluated_amount;
      }
      return String(b.id).localeCompare(String(a.id));
    });
    for (const r of rows.slice(1)) {
      idsToDelete.push(r.id);
    }
  }

  let deleted = 0;
  for (const id of idsToDelete) {
    const { error } = await supabase.from("asset_snapshot_holdings").delete().eq("id", id);
    if (error) {
      console.error("[cashHoldingsDedupe] 삭제 실패:", id, error.message);
      continue;
    }
    deleted += 1;
  }
  return deleted;
}
