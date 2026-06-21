-- Botong orders: two-step confirmation (provisional → confirmed)
-- Does NOT affect ASSET tables.

ALTER TABLE botong_orders
ADD COLUMN IF NOT EXISTS confirmation_status TEXT NOT NULL DEFAULT 'provisional';

COMMENT ON COLUMN botong_orders.confirmation_status IS
  'provisional = 가입력 (발주발송관리), confirmed = 구매확정';
