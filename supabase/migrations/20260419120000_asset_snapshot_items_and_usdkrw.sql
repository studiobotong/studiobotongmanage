-- 요약 스냅샷에 적용 환율 기록
ALTER TABLE asset_snapshots
  ADD COLUMN IF NOT EXISTS usdkrw_rate numeric;

COMMENT ON COLUMN asset_snapshots.usdkrw_rate IS '스냅샷 시점 USD/KRW 환율 (적용 환산에 사용)';

-- 자동 스냅샷 상세 (종목·예수금·채권)
CREATE TABLE IF NOT EXISTS asset_snapshot_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date date NOT NULL,
  name text NOT NULL,
  ticker text,
  asset_type text,
  currency text,
  account text,
  quantity numeric NOT NULL DEFAULT 0,
  price numeric NOT NULL DEFAULT 0,
  evaluated_amount numeric NOT NULL DEFAULT 0,
  target_min_weight numeric,
  target_max_weight numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_asset_snapshot_items_snapshot_date
  ON asset_snapshot_items (snapshot_date);

COMMENT ON TABLE asset_snapshot_items IS '일별 자동 스냅샷: holdings 기준 종목·예수금·채권 상세';
