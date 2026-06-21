-- Botong orders: Naver product number for SKU-based product matching
-- Does NOT affect ASSET tables.

ALTER TABLE botong_orders
ADD COLUMN IF NOT EXISTS naver_product_no TEXT;

COMMENT ON COLUMN botong_orders.naver_product_no IS
  '네이버 상품번호 (구매확정내역 16번째 컬럼). botong_products.sku와 매칭에 사용';
