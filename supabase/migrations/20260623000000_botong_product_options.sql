-- Botong product options: per-option cost, stock, and SKU code for Naver matching
-- Does NOT affect ASSET tables.

CREATE TABLE IF NOT EXISTS botong_product_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES botong_products(id) ON DELETE CASCADE,
  sku_code text NOT NULL,
  option_name text NOT NULL,
  cost_price numeric DEFAULT 0,
  stock_qty integer DEFAULT 0,
  safety_stock integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (product_id, sku_code)
);

COMMENT ON TABLE botong_product_options IS
  '상품 옵션별 원가·재고·옵션관리코드 (네이버 스마트스토어 옵션관리코드와 동일)';

COMMENT ON COLUMN botong_product_options.sku_code IS
  '옵션관리코드 (예: MESH001). 네이버 스마트스토어 옵션관리코드와 동일';

COMMENT ON COLUMN botong_product_options.option_name IS
  '옵션 표기 (예: 사이즈/종류: 미니하트). 주문 엑셀 옵션정보 매칭용';

NOTIFY pgrst, 'reload schema';
