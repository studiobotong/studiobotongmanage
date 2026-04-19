-- market_data_cache 최종 스키마 정리 (원격/로컬 공통, idempotent)
--
-- 앱이 사용하는 컬럼: id, key, category, symbol, market, value_numeric,
-- value_text, currency, source, status, updated_at  (+ UNIQUE(key, category) upsert용)
--
-- 이전에 19150000·19160000을 나눠 적용하던 내용을 한 파일로 합칩니다.
-- 이미 컬럼이 있으면 ADD COLUMN 은 건너뜁니다.

-- ── 컬럼 (누락분만 추가; nullable 은 안전) ─────────────────────────────────
ALTER TABLE market_data_cache ADD COLUMN IF NOT EXISTS symbol text;
ALTER TABLE market_data_cache ADD COLUMN IF NOT EXISTS market text;
ALTER TABLE market_data_cache ADD COLUMN IF NOT EXISTS value_numeric numeric;
ALTER TABLE market_data_cache ADD COLUMN IF NOT EXISTS value_text text;
ALTER TABLE market_data_cache ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE market_data_cache ADD COLUMN IF NOT EXISTS source text;

-- NOT NULL + 기본값: 기존 행에도 채워짐
ALTER TABLE market_data_cache ADD COLUMN IF NOT EXISTS status text DEFAULT 'cached';
ALTER TABLE market_data_cache ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ── 데이터 정규화 (여러 번 실행해도 안전) ───────────────────────────────────

-- 레거시 단일 키 → 표준 키 (19150000)
UPDATE market_data_cache SET key = 'FX:USDKRW', symbol = NULL, market = NULL
  WHERE category = 'fx' AND key = 'USDKRW';

UPDATE market_data_cache SET key = 'SENTIMENT:FEAR_GREED', symbol = NULL, market = NULL
  WHERE category = 'sentiment' AND key = 'FEAR_GREED';

-- FX / Fear&Greed canonical (19160000)
UPDATE market_data_cache
SET
  key = 'FX:USDKRW',
  market = 'FX',
  symbol = 'USDKRW'
WHERE category = 'fx'
  AND (key = 'USDKRW' OR key = 'FX:USDKRW');

UPDATE market_data_cache
SET
  key = 'SENTIMENT:FEAR_GREED',
  market = 'INDEX',
  symbol = 'FEAR_GREED'
WHERE category = 'sentiment'
  AND (key = 'FEAR_GREED' OR key = 'SENTIMENT:FEAR_GREED');

-- quote: 구버전(심볼만 key) → symbol/market/key 정규화 (19150000)
UPDATE market_data_cache
SET
  symbol = key,
  market = CASE
    WHEN key ~ '^\d{6}$' THEN 'KRX'
    ELSE 'US'
  END
WHERE category = 'quote' AND strpos(key, ':') = 0;

UPDATE market_data_cache
SET key = market || ':' || symbol
WHERE category = 'quote'
  AND symbol IS NOT NULL
  AND market IS NOT NULL
  AND strpos(key, ':') = 0;

-- quote: key에 콜론이 있으면 market/symbol 보강 (19160000)
UPDATE market_data_cache
SET
  market = COALESCE(NULLIF(TRIM(market), ''), split_part(key, ':', 1)),
  symbol = COALESCE(NULLIF(TRIM(symbol), ''), NULLIF(split_part(key, ':', 2), ''))
WHERE category = 'quote'
  AND strpos(key, ':') > 0;

-- ── 인덱스 (20260419140000 에 UNIQUE(key,category) 가 있으면 upsert 충족) ───
-- 레거시 테이블에 유니크가 없어 upsert 가 실패하면 SQL Editor 에서만:
--   CREATE UNIQUE INDEX market_data_cache_key_category_uidx
--     ON market_data_cache (key, category);

CREATE INDEX IF NOT EXISTS idx_market_data_cache_category_updated
  ON market_data_cache (category, updated_at DESC);

-- ── 주석 ───────────────────────────────────────────────────────────────────
COMMENT ON TABLE market_data_cache IS
  '실시간 시장 데이터 공통 캐시 (환율·Fear&Greed·종목가; 기기 간 동일 기준)';

COMMENT ON COLUMN market_data_cache.key IS
  '고유 논리 키: FX:USDKRW | SENTIMENT:FEAR_GREED | KRX:종목코드 | US:티커';

COMMENT ON COLUMN market_data_cache.category IS 'quote | fx | sentiment';

COMMENT ON COLUMN market_data_cache.market IS
  'fx→FX, sentiment→INDEX, quote→KRX|US';

COMMENT ON COLUMN market_data_cache.symbol IS
  'fx→USDKRW, sentiment→FEAR_GREED, quote→종목 심볼';

COMMENT ON COLUMN market_data_cache.value_text IS
  '보조 문자열/JSON (예: F&G indexTimestamp 메타)';
