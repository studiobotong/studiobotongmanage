/**
 * 네이버 커머스 API 클라이언트
 * OAuth2 Client Credentials + bcrypt 서명 방식
 */

import bcrypt from "bcryptjs";

const BASE_URL = "https://api.commerce.naver.com/external";

// ── 토큰 발급 ────────────────────────────────────────────────────

export async function getNaverAccessToken(): Promise<string> {
  const clientId = process.env.NAVER_COMMERCE_CLIENT_ID;
  const clientSecret = process.env.NAVER_COMMERCE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("네이버 커머스 API 환경변수가 설정되지 않았습니다.");
  }

  const timestamp = Date.now();
  const password = `${clientId}_${timestamp}`;
  const hashed = bcrypt.hashSync(password, clientSecret);
  const signature = Buffer.from(hashed).toString("base64");

  const params = new URLSearchParams({
    client_id: clientId,
    timestamp: String(timestamp),
    client_secret_sign: signature,
    grant_type: "client_credentials",
    type: "SELF",
  });

  const res = await fetch(
    `${BASE_URL}/v1/oauth2/token?${params.toString()}`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`토큰 발급 실패 (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`토큰 발급 실패: ${JSON.stringify(data)}`);
  }

  return data.access_token as string;
}

// ── 주문 조회 ────────────────────────────────────────────────────

export interface NaverProductOrder {
  productOrderId: string;
  orderId: string;
  orderDate: string;
  paymentDate: string | null;
  productOrderStatus: string;
  productId: string | null;
  productName: string;
  optionCode: string | null;
  optionName: string | null;
  quantity: number;
  unitPrice: number;
  totalPaymentAmount: number;
  deliveryFeeAmount: number;
  expectedSettlementAmount: number;
  buyerName: string | null;
  receiverName: string | null;
  receiverTel: string | null;
  receiverAddress: string | null;
  deliveryCompany: string | null;
  trackingNumber: string | null;
  paymentMeans: string | null;
  channel: string;
  rawData: Record<string, unknown>;
}

/**
 * 주문 조회 (날짜 범위 기준, rangeType: order_date = 주문일)
 */
export async function fetchNaverOrders(
  accessToken: string,
  from: string,
  to: string
): Promise<NaverProductOrder[]> {
  const params = new URLSearchParams({
    rangeType: "PAYED_DATETIME",
    from,
    to,
    pageSize: "300",
    page: "1",
  });

  const res = await fetch(
    `${BASE_URL}/v1/pay-order/seller/product-orders?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`주문 조회 실패 (${res.status}): ${text}`);
  }

  const data = await res.json();

  console.log("[naverAPI] 응답 전체:", JSON.stringify(data).slice(0, 2000));
  const contents = data?.data?.contents ?? data?.contents ?? [];
  console.log("[naverAPI] contents 샘플:", JSON.stringify(contents[0]));
  if (!Array.isArray(contents)) return [];

  return contents.map((item: Record<string, unknown>) => {
    const content = (item.content as Record<string, unknown>) ?? {};
    const order = (content.order as Record<string, unknown>) ?? {};
    const productOrder = (content.productOrder as Record<string, unknown>) ?? {};
    const delivery = (content.delivery as Record<string, unknown>) ?? {};

    return {
      productOrderId: String(item.productOrderId ?? ""),
      orderId: String(order.orderId ?? ""),
      orderDate: String(order.orderDate ?? ""),
      paymentDate: order.paymentDate ? String(order.paymentDate) : null,
      productOrderStatus: String(productOrder.productOrderStatus ?? ""),
      productId: productOrder.productId ? String(productOrder.productId) : null,
      productName: String(productOrder.productName ?? ""),
      optionCode: productOrder.optionCode ? String(productOrder.optionCode) : null,
      optionName: productOrder.productOption ? String(productOrder.productOption) : null,
      quantity: Number(productOrder.quantity ?? 1),
      unitPrice: Number(productOrder.unitPrice ?? 0),
      totalPaymentAmount: Number(productOrder.totalPaymentAmount ?? 0),
      deliveryFeeAmount: Number(productOrder.deliveryFeeAmount ?? 0),
      expectedSettlementAmount: Number(productOrder.expectedSettlementAmount ?? 0),
      buyerName: order.ordererName ? String(order.ordererName) : null,
      receiverName: (productOrder.shippingAddress as Record<string, unknown>)?.name
        ? String((productOrder.shippingAddress as Record<string, unknown>).name)
        : null,
      receiverTel: (productOrder.shippingAddress as Record<string, unknown>)?.tel1
        ? String((productOrder.shippingAddress as Record<string, unknown>).tel1)
        : null,
      receiverAddress: (productOrder.shippingAddress as Record<string, unknown>)?.baseAddress
        ? String((productOrder.shippingAddress as Record<string, unknown>).baseAddress)
        : null,
      deliveryCompany: delivery.deliveryCompany ? String(delivery.deliveryCompany) : null,
      trackingNumber: delivery.trackingNumber ? String(delivery.trackingNumber) : null,
      paymentMeans: order.paymentMeans ? String(order.paymentMeans) : null,
      channel: "naver",
      rawData: item,
    };
  });
}
