-- 공통 시장 데이터 캐시 (환율·Fear & Greed·종목 현재가)
-- 모든 기기가 동일한 최신값을 참조하도록 서버/DB를 단일 소스로 사용합니다.

CREATE TABLE IF NOT EXISTS market_data_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  category text NOT NULL CHECK (category IN ('quote', 'fx', 'sentiment')),
  symbol text,
  market text,
  value_numeric numeric,
  value_text text,
  currency text,
  source text,
  status text NOT NULL DEFAULT 'cached' CHECK (status IN ('live', 'cached', 'fallback', 'error', 'manual')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, category)
);

CREATE INDEX IF NOT EXISTS idx_market_data_cache_category_updated
  ON market_data_cache (category, updated_at DESC);

COMMENT ON TABLE market_data_cache IS '실시간 시장 데이터 공통 캐시 (기기 간 동일 기준)';
COMMENT ON COLUMN market_data_cache.key IS '예: FX:USDKRW, SENTIMENT:FEAR_GREED, KRX:005930, US:NVDA';
COMMENT ON COLUMN market_data_cache.category IS 'quote | fx | sentiment';
COMMENT ON COLUMN market_data_cache.value_text IS '보조 문자열/JSON (예: F&G index 시각 메타)';
