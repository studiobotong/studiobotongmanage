/**
 * lib/assetSnapshots.ts
 *
 * 자산 스냅샷 비즈니스 로직 레이어.
 * 실제 저장/조회는 lib/storage.ts 를 통해서만 수행합니다.
 */

import { getSnapshots, addSnapshot } from "./storage";
import type { AssetSnapshot } from "@/types/assets";

// ─────────────────────────────────────────────────────────────
// 목업 데이터 (스냅샷이 없을 때 차트용 폴백)
// ─────────────────────────────────────────────────────────────

function generateMockSnapshots(): AssetSnapshot[] {
  const snapshots: AssetSnapshot[] = [];
  const start = new Date("2025-10-01");
  const end = new Date("2026-04-12");
  let current = 95_000_000;
  // 투자금은 총자산보다 낮게 시작하고 매월 초 일정 금액 추가 입금 시뮬레이션
  let investment = 88_000_000;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;

    const change = (Math.random() - 0.47) * 0.024;
    current = Math.max(60_000_000, current * (1 + change));

    // 매월 1일 추가 입금 시뮬레이션
    if (d.getDate() === 1) {
      investment += Math.round(Math.random() * 1_000_000 + 500_000);
    }

    const total = Math.round(current);
    const kr = Math.round(total * 0.55);
    const us = Math.round(total * 0.35);
    const cash = total - kr - us;
    const dateStr = d.toISOString().slice(0, 10);
    const profit = total - investment;
    const return_rate = investment > 0 ? (profit / investment) * 100 : 0;

    snapshots.push({
      id: `mock-${dateStr}`,
      snapshot_date: dateStr,
      total_asset: total,
      stock_asset: kr + us,
      cash_asset: cash,
      kr_asset: kr,
      us_asset: us,
      net_investment: investment,
      profit,
      return_rate,
      created_at: new Date().toISOString(),
    });
  }
  return snapshots;
}

// ─────────────────────────────────────────────────────────────
// 전체 조회
// ─────────────────────────────────────────────────────────────

/**
 * 자산 스냅샷 전체를 날짜 오름차순으로 반환합니다.
 * Supabase에 데이터가 없으면 목업 데이터를 반환합니다.
 */
export async function fetchAssetSnapshots(): Promise<AssetSnapshot[]> {
  try {
    const rows = await getSnapshots();
    if (rows.length === 0) {
      console.info("[assetSnapshots] 데이터 없음, 목업 데이터 사용");
      return generateMockSnapshots();
    }
    return [...rows].sort((a, b) =>
      a.snapshot_date.localeCompare(b.snapshot_date)
    );
  } catch (err) {
    console.warn("[assetSnapshots] 조회 실패, 목업 데이터 사용:", err);
    return generateMockSnapshots();
  }
}

// ─────────────────────────────────────────────────────────────
// 스냅샷 저장 (upsert)
// ─────────────────────────────────────────────────────────────

export async function saveAssetSnapshot(
  snapshot: Omit<AssetSnapshot, "id" | "created_at"> & { id?: string; created_at?: string }
): Promise<AssetSnapshot> {
  const payload: AssetSnapshot = {
    id: snapshot.id || "",
    created_at: snapshot.created_at || new Date().toISOString(),
    ...snapshot,
  };
  return addSnapshot(payload);
}
