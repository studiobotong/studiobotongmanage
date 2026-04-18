/**
 * lib/assetSnapshots.ts
 *
 * 자산 스냅샷 비즈니스 로직 레이어.
 * 실제 저장/조회는 lib/storage.ts 를 통해서만 수행합니다.
 */

import { getSnapshots, addSnapshot } from "./storage";
import type { AssetSnapshot } from "@/types/assets";

// ─────────────────────────────────────────────────────────────
// 전체 조회
// ─────────────────────────────────────────────────────────────

/**
 * Supabase `asset_snapshots` 전체를 날짜 오름차순으로 반환합니다.
 * 행이 없으면 빈 배열(차트는 빈 상태 UI).
 */
export async function fetchAssetSnapshots(): Promise<AssetSnapshot[]> {
  const rows = await getSnapshots();
  return [...rows].sort((a, b) =>
    a.snapshot_date.localeCompare(b.snapshot_date)
  );
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
