-- 광고 리포트 테이블 (메타/네이버 광고 데이터)
-- Supabase SQL Editor에서 직접 실행하세요.
-- 실행 후 반드시: NOTIFY pgrst, 'reload schema';

CREATE TABLE IF NOT EXISTS botong_ad_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,        -- 'meta' 또는 'naver'
  campaign_name text,            -- 캠페인명
  report_date date NOT NULL,     -- 광고 데이터 날짜
  spend numeric DEFAULT 0,       -- 광고비 (원)
  impressions integer DEFAULT 0, -- 노출수
  clicks integer DEFAULT 0,      -- 클릭수
  conversions integer DEFAULT 0, -- 전환수 (구매)
  revenue numeric DEFAULT 0,     -- 광고 기여 매출 (원)
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_botong_ad_reports_date
  ON botong_ad_reports (report_date);

CREATE INDEX IF NOT EXISTS idx_botong_ad_reports_platform
  ON botong_ad_reports (platform);

NOTIFY pgrst, 'reload schema';
