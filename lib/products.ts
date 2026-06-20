import { supabase } from "./supabaseClient";
import { toHttpsImageUrl } from "@/lib/utils/imageUrl";
import type {
  BotongProduct,
  CsvUploadResult,
  ProductCsvRow,
  ProductFormData,
} from "@/types/products";

function normalizeImageUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  return toHttpsImageUrl(trimmed);
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapRow(r: Record<string, unknown>): BotongProduct {
  return {
    id: String(r.id ?? ""),
    product_name: String(r.product_name ?? ""),
    option_name: String(r.option_name ?? ""),
    sku: r.sku != null ? String(r.sku) : null,
    category: r.category != null ? String(r.category) : null,
    image_url: r.image_url != null ? String(r.image_url) : null,
    selling_price: toNum(r.selling_price),
    cost_price: toNum(r.cost_price),
    stock_qty: toNum(r.stock_qty),
    safety_stock: toNum(r.safety_stock),
    is_active: Boolean(r.is_active),
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  };
}

export async function getProducts(): Promise<BotongProduct[]> {
  const { data, error } = await supabase
    .from("botong_products")
    .select("*")
    .order("product_name", { ascending: true });

  if (error) {
    console.error("[products] getProducts 오류:", error.message);
    return [];
  }

  return (data ?? []).map(mapRow);
}

export async function createProduct(
  form: ProductFormData
): Promise<{ product: BotongProduct | null; error: string | null }> {
  const { data, error } = await supabase
    .from("botong_products")
    .insert({
      product_name: form.product_name.trim(),
      option_name: form.option_name.trim(),
      sku: form.sku.trim() || null,
      category: form.category.trim() || null,
      image_url: normalizeImageUrl(form.image_url),
      selling_price: form.selling_price,
      cost_price: form.cost_price,
      stock_qty: form.stock_qty,
      safety_stock: form.safety_stock,
      is_active: form.is_active,
    })
    .select()
    .single();

  if (error) {
    return { product: null, error: error.message };
  }

  return { product: mapRow(data), error: null };
}

export async function updateProduct(
  id: string,
  fields: Partial<
    Pick<
      BotongProduct,
      | "product_name"
      | "option_name"
      | "sku"
      | "category"
      | "image_url"
      | "selling_price"
      | "cost_price"
      | "stock_qty"
      | "safety_stock"
      | "is_active"
    >
  >
): Promise<{ error: string | null }> {
  const payload = {
    ...fields,
    ...(fields.image_url !== undefined && {
      image_url: normalizeImageUrl(fields.image_url),
    }),
  };

  const { error } = await supabase
    .from("botong_products")
    .update(payload)
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function deleteProduct(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("botong_products").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

export async function upsertProductsFromCsv(
  rows: ProductCsvRow[]
): Promise<CsvUploadResult> {
  const result: CsvUploadResult = {
    inserted: 0,
    updated: 0,
    errors: 0,
    errorMessages: [],
  };

  for (const row of rows) {
    try {
      const { data: existing, error: fetchError } = await supabase
        .from("botong_products")
        .select("id, cost_price, safety_stock")
        .eq("product_name", row.product_name)
        .eq("option_name", "")
        .maybeSingle();

      if (fetchError) {
        result.errors++;
        result.errorMessages.push(
          `'${row.product_name}': 조회 실패 — ${fetchError.message}`
        );
        continue;
      }

      if (!existing) {
        const { error: insertError } = await supabase
          .from("botong_products")
          .insert({
            product_name: row.product_name,
            option_name: "",
            sku: row.sku,
            category: row.category,
            image_url: normalizeImageUrl(row.image_url),
            selling_price: row.selling_price,
            cost_price: 0,
            stock_qty: row.stock_qty,
            safety_stock: 0,
            is_active: row.is_active,
          });

        if (insertError) {
          result.errors++;
          result.errorMessages.push(
            `'${row.product_name}': 등록 실패 — ${insertError.message}`
          );
        } else {
          result.inserted++;
        }
      } else {
        const { error: updateError } = await supabase
          .from("botong_products")
          .update({
            sku: row.sku,
            category: row.category,
            image_url: normalizeImageUrl(row.image_url),
            selling_price: row.selling_price,
            stock_qty: row.stock_qty,
            is_active: row.is_active,
          })
          .eq("id", existing.id);

        if (updateError) {
          result.errors++;
          result.errorMessages.push(
            `'${row.product_name}': 갱신 실패 — ${updateError.message}`
          );
        } else {
          result.updated++;
        }
      }
    } catch (e) {
      result.errors++;
      result.errorMessages.push(
        `'${row.product_name}': ${e instanceof Error ? e.message : "알 수 없는 오류"}`
      );
    }
  }

  return result;
}
