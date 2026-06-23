-- Botong orders: link to matched product option via option management code
-- Does NOT affect ASSET tables.

ALTER TABLE botong_orders
ADD COLUMN IF NOT EXISTS option_id uuid REFERENCES botong_product_options(id);

COMMENT ON COLUMN botong_orders.option_id IS
  '매칭된 botong_product_options.id (옵션관리코드 기반 매칭 시 설정)';

NOTIFY pgrst, 'reload schema';
