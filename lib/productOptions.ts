import { supabase } from "./supabaseClient";
import type {
  BotongProductOption,
  OptionEditableFields,
  OptionExcelRow,
  OptionUploadResult,
} from "@/types/productOptions";

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapRow(r: Record<string, unknown>): BotongProductOption {
  return {
    id: String(r.id ?? ""),
    product_id: String(r.product_id ?? ""),
    sku_code: String(r.sku_code ?? ""),
    option_name: String(r.option_name ?? ""),
    cost_price: toNum(r.cost_price),
    stock_qty: toNum(r.stock_qty),
    safety_stock: toNum(r.safety_stock),
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

export async function getProductOptions(
  productId: string
): Promise<BotongProductOption[]> {
  const { data, error } = await supabase
    .from("botong_product_options")
    .select("*")
    .eq("product_id", productId)
    .order("sku_code", { ascending: true });

  if (error) {
    console.error("[productOptions] getProductOptions 오류:", error.message);
    return [];
  }

  return (data ?? []).map(mapRow);
}

export async function updateProductOption(
  id: string,
  fields: Partial<OptionEditableFields>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("botong_product_options")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function deleteProductOption(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("botong_product_options")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function upsertOptionsFromExcel(
  rows: OptionExcelRow[]
): Promise<OptionUploadResult> {
  const result: OptionUploadResult = {
    inserted: 0,
    updated: 0,
    skipped: 0,
  };

  const skus = [
    ...new Set(rows.map((r) => r.product_sku.trim()).filter(Boolean)),
  ];

  const skuToProductId = new Map<string, string>();

  if (skus.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < skus.length; i += batchSize) {
      const batch = skus.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from("botong_products")
        .select("id, sku")
        .in("sku", batch);

      if (error) {
        console.error("[productOptions] 상품 조회 오류:", error.message);
        result.skipped += rows.length;
        return result;
      }

      for (const product of data ?? []) {
        const sku = String(product.sku ?? "").trim();
        if (sku) skuToProductId.set(sku, String(product.id));
      }
    }
  }

  for (const row of rows) {
    const productId = skuToProductId.get(row.product_sku.trim());
    if (!productId) {
      result.skipped += 1;
      continue;
    }

    const skuCode = row.sku_code.trim();
    if (!skuCode) {
      result.skipped += 1;
      continue;
    }

    const { data: existing, error: fetchError } = await supabase
      .from("botong_product_options")
      .select("id")
      .eq("product_id", productId)
      .eq("sku_code", skuCode)
      .maybeSingle();

    if (fetchError) {
      result.skipped += 1;
      continue;
    }

    const payload = {
      product_id: productId,
      sku_code: skuCode,
      option_name: row.option_name.trim() || "(옵션 없음)",
      cost_price: row.cost_price,
      safety_stock: row.safety_stock,
      stock_qty: row.stock_qty,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { error: updateError } = await supabase
        .from("botong_product_options")
        .update(payload)
        .eq("id", existing.id);

      if (updateError) {
        result.skipped += 1;
      } else {
        result.updated += 1;
      }
    } else {
      const { error: insertError } = await supabase
        .from("botong_product_options")
        .insert(payload);

      if (insertError) {
        result.skipped += 1;
      } else {
        result.inserted += 1;
      }
    }
  }

  return result;
}

export async function findOptionBySkuCode(
  skuCode: string
): Promise<{ id: string; product_id: string } | null> {
  const code = skuCode.trim();
  if (!code) return null;

  const { data, error } = await supabase
    .from("botong_product_options")
    .select("id, product_id")
    .eq("sku_code", code)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: String(data.id),
    product_id: String(data.product_id),
  };
}
