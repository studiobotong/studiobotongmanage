-- Botong purchases: stock inbound purchase records (Task A)
-- Does NOT affect ASSET tables.

CREATE TABLE IF NOT EXISTS botong_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  product_id UUID NOT NULL REFERENCES botong_products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  supplier TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_botong_purchases_product_id
  ON botong_purchases(product_id);

CREATE INDEX IF NOT EXISTS idx_botong_purchases_purchase_date
  ON botong_purchases(purchase_date DESC);

-- Link stock movements to purchases (if column missing)
ALTER TABLE botong_stock_movements
ADD COLUMN IF NOT EXISTS related_purchase_id UUID REFERENCES botong_purchases(id);
