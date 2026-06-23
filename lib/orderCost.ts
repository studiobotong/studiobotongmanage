import { supabase } from "./supabaseClient";

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 순이익 계산에 사용 가능한 원가인지 (0·null 제외) */
export function isValidCostPrice(cost: number | null | undefined): cost is number {
  return cost != null && cost > 0;
}

export interface OrderCostInput {
  option_id: string | null;
  product_id: string | null;
}

/**
 * 주문 1건의 원가를 결정합니다.
 * 1. option_id → botong_product_options.cost_price
 * 2. product_id → botong_products.cost_price (fallback)
 * 3. 둘 다 없으면 null (마진 계산 제외)
 */
export async function resolveOrderCostPrice(
  order: OrderCostInput
): Promise<number | null> {
  if (order.option_id) {
    const { data, error } = await supabase
      .from("botong_product_options")
      .select("cost_price")
      .eq("id", order.option_id)
      .maybeSingle();

    if (!error && data) {
      const cost = toNum(data.cost_price);
      return isValidCostPrice(cost) ? cost : null;
    }
  }

  if (order.product_id) {
    const { data, error } = await supabase
      .from("botong_products")
      .select("cost_price")
      .eq("id", order.product_id)
      .maybeSingle();

    if (!error && data) {
      const cost = toNum(data.cost_price);
      return isValidCostPrice(cost) ? cost : null;
    }
  }

  return null;
}

/**
 * 여러 주문의 원가를 일괄 조회합니다.
 */
export async function resolveOrderCostPrices(
  orders: OrderCostInput[]
): Promise<Map<number, number | null>> {
  const result = new Map<number, number | null>();

  const optionIds = [
    ...new Set(
      orders
        .map((o) => o.option_id?.trim())
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const productIds = [
    ...new Set(
      orders
        .map((o) => o.product_id?.trim())
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const optionCostMap = new Map<string, number>();
  const productCostMap = new Map<string, number>();

  if (optionIds.length > 0) {
    const { data } = await supabase
      .from("botong_product_options")
      .select("id, cost_price")
      .in("id", optionIds);

    for (const row of data ?? []) {
      const cost = toNum(row.cost_price);
      if (isValidCostPrice(cost)) {
        optionCostMap.set(String(row.id), cost);
      }
    }
  }

  if (productIds.length > 0) {
    const { data } = await supabase
      .from("botong_products")
      .select("id, cost_price")
      .in("id", productIds);

    for (const row of data ?? []) {
      const cost = toNum(row.cost_price);
      if (isValidCostPrice(cost)) {
        productCostMap.set(String(row.id), cost);
      }
    }
  }

  orders.forEach((order, index) => {
    if (order.option_id && optionCostMap.has(order.option_id)) {
      result.set(index, optionCostMap.get(order.option_id)!);
      return;
    }
    if (order.product_id && productCostMap.has(order.product_id)) {
      result.set(index, productCostMap.get(order.product_id)!);
      return;
    }
    result.set(index, null);
  });

  return result;
}
