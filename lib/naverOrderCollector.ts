/**
 * 네이버 주문 수집 → btm_orders_raw 저장
 */

import { btmSupabase } from "./btmSupabaseClient";
import { getNaverAccessToken, fetchNaverOrders } from "./naverCommerceApi";
import type { NaverProductOrder } from "./naverCommerceApi";

export interface OrderCollectResult {
  upserted: number;
  total: number;
  elapsedMs: number;
  errors: string[];
  dateRange: { from: string; to: string };
}

function buildPayload(order: NaverProductOrder) {
  return {
    order_id: order.productOrderId,
    product_order_id: order.orderId,
    order_date: order.orderDate || null,
    payment_date: order.paymentDate || null,
    confirm_date: null,
    status: order.productOrderStatus || null,
    product_id: order.productId || null,
    product_name: order.productName || null,
    option_code: order.optionCode || null,
    option_name: order.optionName || null,
    quantity: order.quantity,
    unit_price: order.unitPrice,
    total_price: order.totalPaymentAmount,
    discount_amount: 0,
    actual_payment: order.expectedSettlementAmount,
    buyer_name: order.buyerName || null,
    receiver_name: order.receiverName || null,
    receiver_phone: order.receiverTel || null,
    receiver_address: order.receiverAddress || null,
    delivery_company: order.deliveryCompany || null,
    tracking_number: order.trackingNumber || null,
    channel: "naver",
    raw_data: order.rawData ?? {},
    collected_at: new Date().toISOString(),
  };
}

export async function collectNaverOrders(): Promise<OrderCollectResult> {
  const started = Date.now();
  const result: OrderCollectResult = {
    upserted: 0,
    total: 0,
    elapsedMs: 0,
    errors: [],
    dateRange: { from: "", to: "" },
  };

  try {
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    // KST 오늘 00:00
    const todayKstMidnight = new Date(
      Math.floor((now.getTime() + kstOffset) / 86400000) * 86400000 - kstOffset
    );
    const from = todayKstMidnight.toISOString().replace("Z", "+09:00");
    const to = now.toISOString().replace("Z", "+09:00");
    result.dateRange = { from, to };

    const accessToken = await getNaverAccessToken();
    const orders = await fetchNaverOrders(accessToken, from, to);
    result.total = orders.length;

    for (const order of orders) {
      const payload = buildPayload(order);
      const { error } = await btmSupabase
        .from("btm_orders_raw")
        .upsert(payload, { onConflict: "order_id" });

      if (error) {
        result.errors.push(`${order.productOrderId}: ${error.message}`);
        continue;
      }
      result.upserted += 1;
    }
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e));
  }

  result.elapsedMs = Date.now() - started;
  return result;
}

/** 날짜 범위를 하루씩 쪼개서 전체 수집 */
export async function collectNaverOrdersRange(
  fromDate: string, // YYYY-MM-DD
  toDate: string    // YYYY-MM-DD
): Promise<{ totalUpserted: number; totalErrors: string[]; days: number }> {
  const result = { totalUpserted: 0, totalErrors: [] as string[], days: 0 };

  const current = new Date(`${fromDate}T00:00:00+09:00`);
  const end = new Date(`${toDate}T23:59:59+09:00`);

  while (current <= end) {
    const dayStart = new Date(current);
    const dayEnd = new Date(current);
    dayEnd.setHours(23, 59, 59, 999);

    const from = dayStart.toISOString().replace("Z", "+09:00");
    const to = dayEnd.toISOString().replace("Z", "+09:00");
    const dayIso = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;

    try {
      const accessToken = await getNaverAccessToken();
      const orders = await fetchNaverOrders(accessToken, from, to);

      for (const order of orders) {
        const payload = buildPayload(order);
        const { error } = await btmSupabase
          .from("btm_orders_raw")
          .upsert(payload, { onConflict: "order_id" });

        if (error) {
          result.totalErrors.push(`${order.productOrderId}: ${error.message}`);
        } else {
          result.totalUpserted += 1;
        }
      }
      result.days += 1;
    } catch (e) {
      result.totalErrors.push(`${dayIso}: ${e instanceof Error ? e.message : String(e)}`);
    }

    current.setDate(current.getDate() + 1);
    await new Promise(r => setTimeout(r, 100));
  }

  return result;
}
