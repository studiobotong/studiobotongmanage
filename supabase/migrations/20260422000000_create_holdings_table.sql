-- ─────────────────────────────────────────────────────────────
-- holdings  — 현재 보유현황 원본 테이블 (snapshot_date 없음)
--
-- 역할:
--   * HoldingsManager 화면에서 직접 읽고 쓰는 "현재 상태" 원본
--   * 날짜 기반 이력은 asset_snapshot_holdings(기존 유지)가 담당
--
-- 이관 전략:
--   asset_snapshot_holdings 에서 MAX(snapshot_date) 기준
--   DISTINCT ON (symbol·market·account·asset_type) 으로 중복 제거 후 삽입
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS holdings (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text        NOT NULL,
  symbol            text,
  market            text,
  currency          text,
  account           text,
  quantity          numeric     NOT NULL DEFAULT 0,
  avg_price         numeric     NOT NULL DEFAULT 0,
  current_price     numeric              DEFAULT 0,
  evaluated_amount  numeric              DEFAULT 0,
  weight            numeric,
  target_min_weight numeric,
  target_max_weight numeric,
  asset_type        text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- updated_at 자동 갱신 트리거 ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_holdings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_holdings_updated_at ON holdings;
CREATE TRIGGER trg_holdings_updated_at
  BEFORE UPDATE ON holdings
  FOR EACH ROW EXECUTE FUNCTION update_holdings_updated_at();

-- 최신 snapshot 기준 초기 이관 ──────────────────────────────────
-- 이미 행이 있는 경우(재실행) INSERT 를 건너뜁니다.
DO $$
DECLARE
  latest_date date;
BEGIN
  -- holdings 에 이미 데이터가 있으면 이관 생략
  IF (SELECT COUNT(*) FROM holdings) > 0 THEN
    RAISE NOTICE 'holdings 테이블에 이미 데이터가 있습니다. 초기 이관을 건너뜁니다.';
    RETURN;
  END IF;

  -- asset_snapshot_holdings 에 데이터가 없으면 이관 생략
  SELECT MAX(snapshot_date) INTO latest_date
    FROM asset_snapshot_holdings
   WHERE snapshot_date IS NOT NULL;

  IF latest_date IS NULL THEN
    RAISE NOTICE 'asset_snapshot_holdings 에 데이터가 없습니다. 빈 holdings 테이블로 시작합니다.';
    RETURN;
  END IF;

  RAISE NOTICE '최신 snapshot_date = % 기준으로 초기 이관을 시작합니다.', latest_date;

  INSERT INTO holdings (
    name, symbol, market, currency, account,
    quantity, avg_price, current_price, evaluated_amount,
    weight, target_min_weight, target_max_weight, asset_type,
    created_at, updated_at
  )
  SELECT
    name, symbol, market, currency, account,
    quantity, avg_price, current_price, evaluated_amount,
    weight, target_min_weight, target_max_weight, asset_type,
    created_at, now()
  FROM (
    -- 같은 종목·계좌 중복이 있을 경우 evaluated_amount 가 큰 최신 행만 유지
    SELECT DISTINCT ON (
      COALESCE(symbol, name),
      COALESCE(market,     ''),
      COALESCE(account,    ''),
      COALESCE(asset_type, '')
    )
      name, symbol, market, currency, account,
      quantity, avg_price, current_price, evaluated_amount,
      weight, target_min_weight, target_max_weight, asset_type,
      created_at
    FROM asset_snapshot_holdings
    WHERE snapshot_date = latest_date
    ORDER BY
      COALESCE(symbol, name),
      COALESCE(market,     ''),
      COALESCE(account,    ''),
      COALESCE(asset_type, ''),
      evaluated_amount DESC
  ) AS deduped;

  RAISE NOTICE '초기 이관 완료.';
END;
$$;

-- 테이블/컬럼 코멘트 ────────────────────────────────────────────
COMMENT ON TABLE holdings IS
  '현재 보유현황 원본 (snapshot_date 없음). 날짜 기반 이력은 asset_snapshot_holdings 참조.';
COMMENT ON COLUMN holdings.updated_at IS
  'UPDATE 시 트리거가 자동 갱신 (created_at 은 INSERT 시 고정).';
