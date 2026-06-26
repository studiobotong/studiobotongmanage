import bcrypt from "bcryptjs";

const CLIENT_ID = process.env.NAVER_COMMERCE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.NAVER_COMMERCE_CLIENT_SECRET ?? "";
const BASE_URL = "https://api.commerce.naver.com/external";

// ── 토큰 발급 (기존 naverCommerceApi.ts와 동일 방식) ─────────────
async function getNaverAccessToken(): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("네이버 커머스 API 환경변수가 설정되지 않았습니다.");
  }
  const timestamp = Date.now();
  const hashed = await bcrypt.hash(
    `${CLIENT_ID}_${timestamp}`,
    CLIENT_SECRET
  );
  const signature = Buffer.from(hashed).toString("base64");

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      timestamp: String(timestamp),
      client_secret_sign: signature,
      grant_type: "client_credentials",
      type: "SELF",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`토큰 발급 실패 (${res.status}): ${text}`);
  }
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

// ── 타입 ─────────────────────────────────────────────────────────
export interface NaverOptionCombination {
  id: number;
  optionName1: string | null;
  optionName2: string | null;
  optionName3: string | null;
  optionName4: string | null;
  stockQuantity: number;
  price: number;
  sellerManagerCode: string | null;
  usable: boolean;
}

export interface NaverProductDetail {
  channelProductNo: string;
  productId: string;
  name: string;
  statusType: string;          // SALE | SUSPENSION | OUTOFSTOCK 등
  salePrice: number;
  stockQuantity: number;
  thumbnailUrl: string | null;
  optionCombinations: NaverOptionCombination[];
  optionGroupName1: string | null;
  optionGroupName2: string | null;
}

// ── 상품 목록 조회 ────────────────────────────────────────────────
// POST /v1/products/search (빈 body → 전체 반환)
export async function fetchNaverProductList(): Promise<
  { channelProductNo: string; productId: string }[]
> {
  const accessToken = await getNaverAccessToken();

  const res = await fetch(`${BASE_URL}/v1/products/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`상품 목록 조회 실패 (${res.status}): ${text}`);
  }

  const data = await res.json() as {
    contents?: { channelProductNo: string; productId: string }[];
  };
  return data.contents ?? [];
}

// ── 상품 상세 조회 (옵션 포함) ────────────────────────────────────
// GET /v2/products/channel-products/{channelProductNo}
export async function fetchNaverProductDetail(
  channelProductNo: string
): Promise<NaverProductDetail | null> {
  const accessToken = await getNaverAccessToken();

  const res = await fetch(
    `${BASE_URL}/v2/products/channel-products/${channelProductNo}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    console.warn(`상품 상세 조회 실패 (${channelProductNo}): ${res.status}`);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any;

  const origin = data?.originProduct ?? {};
  const optionInfo = origin?.detailAttribute?.optionInfo ?? {};
  const combinations: NaverOptionCombination[] =
    optionInfo?.optionCombinations ?? [];
  const groupNames = optionInfo?.optionCombinationGroupNames ?? {};

  const smChannel = data?.smartstoreChannelProduct ?? {};
  const thumbnailUrl =
    origin?.images?.representativeImage?.url ??
    smChannel?.channelProductImageUrl ??
    null;

  return {
    channelProductNo,
    productId: String(data?.originProductNo ?? channelProductNo),
    name: origin?.name ?? "",
    statusType: origin?.statusType ?? "SALE",
    salePrice: origin?.salePrice ?? 0,
    stockQuantity: origin?.stockQuantity ?? 0,
    thumbnailUrl,
    optionCombinations: combinations,
    optionGroupName1: groupNames?.optionGroupName1 ?? null,
    optionGroupName2: groupNames?.optionGroupName2 ?? null,
  };
}
