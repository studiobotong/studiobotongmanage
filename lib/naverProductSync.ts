import { btmSupabase } from "./btmSupabaseClient";
import {
  fetchNaverProductList,
  fetchNaverProductDetail,
} from "./naverProductApi";
import type { NaverProductDetail } from "./naverProductApi";

export interface ProductSyncResult {
  productsUpserted: number;
  optionsUpserted: number;
  errors: string[];
  elapsedMs: number;
}

// 옵션명 조합 (optionName1 / optionName2)
function buildOptionName(
  name1: string | null,
  name2: string | null
): string {
  const parts = [name1, name2].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "기본";
}

// 단일 상품을 btm_products + btm_product_options에 upsert
async function upsertProduct(detail: NaverProductDetail): Promise<number> {
  // btm_products upsert
  const { error: prodErr } = await btmSupabase
    .from("btm_products")
    .upsert(
      {
        product_id: detail.channelProductNo,
        naver_product_no: detail.productId,
        product_name: detail.name,
        status: detail.statusType,
        sale_price: detail.salePrice,
        thumbnail_url: detail.thumbnailUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "product_id" }
    );

  if (prodErr) throw new Error(`상품 upsert 실패: ${prodErr.message}`);

  // btm_product_options upsert
  let optCount = 0;

  if (detail.optionCombinations.length > 0) {
    for (const combo of detail.optionCombinations) {
      const optionName = buildOptionName(combo.optionName1, combo.optionName2);
      const { error: optErr } = await btmSupabase
        .from("btm_product_options")
        .upsert(
          {
            product_id: detail.channelProductNo,
            option_code: String(combo.id),
            option_name: optionName,
            option_name1: combo.optionName1 ?? null,
            option_name2: combo.optionName2 ?? null,
            selling_price: detail.salePrice + (combo.price ?? 0),
            stock_quantity: combo.stockQuantity ?? 0,
            is_active: combo.usable ?? true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "product_id,option_code" }
        );
      if (!optErr) optCount++;
    }
  } else {
    // 옵션 없는 단일 상품
    const { error: optErr } = await btmSupabase
      .from("btm_product_options")
      .upsert(
        {
          product_id: detail.channelProductNo,
          option_code: detail.channelProductNo,
          option_name: "단일상품",
          selling_price: detail.salePrice,
          stock_quantity: detail.stockQuantity ?? 0,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "product_id,option_code" }
      );
    if (!optErr) optCount++;
  }

  return optCount;
}

// 전체 상품 동기화 (메인 함수)
export async function syncNaverProducts(): Promise<ProductSyncResult> {
  const started = Date.now();
  const result: ProductSyncResult = {
    productsUpserted: 0,
    optionsUpserted: 0,
    errors: [],
    elapsedMs: 0,
  };

  try {
    // 1. 전체 상품 목록 조회
    const productList = await fetchNaverProductList();

    // 2. 각 상품 상세 조회 + upsert
    for (const item of productList) {
      try {
        const detail = await fetchNaverProductDetail(item.channelProductNo);
        if (!detail) {
          result.errors.push(`상세 조회 실패: ${item.channelProductNo}`);
          continue;
        }
        const optCount = await upsertProduct(detail);
        result.productsUpserted++;
        result.optionsUpserted += optCount;

        // API 과부하 방지 딜레이
        await new Promise((r) => setTimeout(r, 150));
      } catch (e) {
        result.errors.push(
          `${item.channelProductNo}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }
  } catch (e) {
    result.errors.push(e instanceof Error ? e.message : String(e));
  }

  result.elapsedMs = Date.now() - started;
  return result;
}
