import { btmSupabase } from "./btmSupabaseClient";

// ── 타입 ─────────────────────────────────────────────────────────

export interface BTMSupplier {
  id: number;
  name: string;
  contact: string | null;
  address: string | null;
  website: string | null;
  memo: string | null;
  created_at: string;
}

export interface BTMMaterial {
  id: number;
  name: string;
  unit: string;
  category: string;
  unit_price: number;
  memo: string | null;
  created_at: string;
}

export interface BTMPurchase {
  id: number;
  purchase_date: string;
  supplier_id: number | null;
  purchase_type: "product" | "material";
  product_id: string | null;
  option_id: number | null;
  material_id: number | null;
  quantity: number;
  unit_price: number;
  import_tax: number;
  purchase_fee: number;
  is_overseas: boolean;
  shipping_local: number;
  shipping_intl: number;
  shipping_domestic: number;
  other_cost: number;
  final_unit_price: number;
  purchase_url: string | null;
  memo: string | null;
  created_at: string;
  // join
  supplier_name?: string;
  product_name?: string;
  option_name?: string;
  material_name?: string;
}

export interface BTMCostRow {
  id: number;
  product_id: string;
  product_name: string;
  option_code: string;
  option_name: string;
  selling_price: number;
  cost_price: number;
  labor_cost: number;
  total_cost: number;
  stock_quantity: number;
  is_manual_cost: boolean;
  sort_order?: number;
}

// ── 거래처 ───────────────────────────────────────────────────────

export async function getSuppliers(): Promise<BTMSupplier[]> {
  const { data } = await btmSupabase
    .from("btm_suppliers")
    .select("*")
    .order("name");
  return (data ?? []) as BTMSupplier[];
}

export async function createSupplier(
  values: Omit<BTMSupplier, "id" | "created_at">
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await btmSupabase.from("btm_suppliers").insert(values);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function updateSupplier(
  id: number,
  values: Partial<Omit<BTMSupplier, "id" | "created_at">>
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await btmSupabase
    .from("btm_suppliers")
    .update(values)
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteSupplier(id: number): Promise<{ ok: boolean; error?: string }> {
  const { error } = await btmSupabase.from("btm_suppliers").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── 부자재 ───────────────────────────────────────────────────────

export async function getMaterials(): Promise<BTMMaterial[]> {
  const { data } = await btmSupabase
    .from("btm_materials")
    .select("*")
    .order("category")
    .order("name");
  return (data ?? []) as BTMMaterial[];
}

export async function createMaterial(
  values: Omit<BTMMaterial, "id" | "created_at">
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await btmSupabase.from("btm_materials").insert(values);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function updateMaterial(
  id: number,
  values: Partial<Omit<BTMMaterial, "id" | "created_at">>
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await btmSupabase
    .from("btm_materials")
    .update(values)
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteMaterial(id: number): Promise<{ ok: boolean; error?: string }> {
  const { error } = await btmSupabase.from("btm_materials").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── 구매내역 ─────────────────────────────────────────────────────

export async function getPurchases(limit = 100): Promise<BTMPurchase[]> {
  const { data } = await btmSupabase
    .from("btm_purchases")
    .select("*")
    .order("purchase_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  const purchases = (data ?? []) as BTMPurchase[];
  if (purchases.length === 0) return [];

  const productIds  = [...new Set(purchases.filter(p => p.product_id).map(p => p.product_id!))];
  const optionIds   = [...new Set(purchases.filter(p => p.option_id).map(p => p.option_id!))];
  const materialIds = [...new Set(purchases.filter(p => p.material_id).map(p => p.material_id!))];
  const supplierIds = [...new Set(purchases.filter(p => p.supplier_id).map(p => p.supplier_id!))];

  const [prods, opts, mats, sups] = await Promise.all([
    productIds.length  ? btmSupabase.from("btm_products").select("product_id, product_name").in("product_id", productIds) : { data: [] },
    optionIds.length   ? btmSupabase.from("btm_product_options").select("id, option_name").in("id", optionIds) : { data: [] },
    materialIds.length ? btmSupabase.from("btm_materials").select("id, name").in("id", materialIds) : { data: [] },
    supplierIds.length ? btmSupabase.from("btm_suppliers").select("id, name").in("id", supplierIds) : { data: [] },
  ]);

  const productMap:  Record<string, string> = {};
  const optionMap:   Record<number, string> = {};
  const materialMap: Record<number, string> = {};
  const supplierMap: Record<number, string> = {};

  for (const p of prods.data   ?? []) productMap[(p as {product_id:string; product_name:string}).product_id]  = (p as {product_id:string; product_name:string}).product_name;
  for (const o of opts.data    ?? []) optionMap[(o as {id:number; option_name:string}).id]                     = (o as {id:number; option_name:string}).option_name;
  for (const m of mats.data    ?? []) materialMap[(m as {id:number; name:string}).id]                          = (m as {id:number; name:string}).name;
  for (const s of sups.data    ?? []) supplierMap[(s as {id:number; name:string}).id]                          = (s as {id:number; name:string}).name;

  return purchases.map(p => ({
    ...p,
    product_name:  p.product_id  ? productMap[p.product_id]   : undefined,
    option_name:   p.option_id   ? optionMap[p.option_id]     : undefined,
    material_name: p.material_id ? materialMap[p.material_id] : undefined,
    supplier_name: p.supplier_id ? supplierMap[p.supplier_id] : undefined,
  }));
}

export async function createPurchase(
  values: Omit<BTMPurchase, "id" | "created_at" | "supplier_name" | "product_name" | "option_name" | "material_name">
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await btmSupabase.from("btm_purchases").insert(values);
  if (error) return { ok: false, error: error.message };

  // 구매 후 원가 자동 갱신
  await refreshCostPrice(values);
  return { ok: true };
}

export async function updatePurchase(
  id: number,
  values: Omit<BTMPurchase, "id" | "created_at" | "supplier_name" | "product_name" | "option_name" | "material_name">
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await btmSupabase.from("btm_purchases").update(values).eq("id", id);
  if (error) return { ok: false, error: error.message };
  await refreshCostPrice(values);
  return { ok: true };
}

export async function deletePurchase(id: number): Promise<{ ok: boolean; error?: string }> {
  const { error } = await btmSupabase.from("btm_purchases").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── 원가 자동 갱신 ───────────────────────────────────────────────

async function refreshCostPrice(
  purchase: Omit<BTMPurchase, "id" | "final_unit_price" | "created_at" | "supplier_name" | "product_name" | "option_name" | "material_name">
): Promise<void> {
  // 최종단가 계산
  const totalExtra = purchase.is_overseas
    ? ((purchase.import_tax ?? 0) + (purchase.shipping_local ?? 0) + (purchase.shipping_intl ?? 0) + (purchase.purchase_fee ?? 0) + (purchase.other_cost ?? 0))
    : ((purchase.shipping_domestic ?? 0) + (purchase.other_cost ?? 0));

  const finalPrice = purchase.quantity > 0
    ? Math.round((purchase.unit_price + totalExtra) / purchase.quantity)
    : purchase.unit_price;

  if (purchase.purchase_type === "product") {
    if (purchase.option_id) {
      // 특정 옵션만 갱신
      await btmSupabase
        .from("btm_product_options")
        .update({ cost_price: finalPrice })
        .eq("id", purchase.option_id);
    } else if (purchase.product_id) {
      // 전체 옵션 일괄 갱신
      await btmSupabase
        .from("btm_product_options")
        .update({ cost_price: finalPrice })
        .eq("product_id", purchase.product_id);
    }
  }

  // total_cost 재계산 (cost_price + labor_cost, 부자재비는 추후 연동)
  if (purchase.purchase_type === "product") {
    const targetQuery = purchase.option_id
      ? btmSupabase.from("btm_product_options").select("id, cost_price, labor_cost").eq("id", purchase.option_id)
      : btmSupabase.from("btm_product_options").select("id, cost_price, labor_cost").eq("product_id", purchase.product_id ?? "");

    const { data: opts } = await targetQuery;
    for (const opt of opts ?? []) {
      await btmSupabase
        .from("btm_product_options")
        .update({ total_cost: (opt.cost_price ?? 0) + (opt.labor_cost ?? 0) })
        .eq("id", opt.id);
    }
  }
}

// ── 원가표 ───────────────────────────────────────────────────────

export async function getCostTable(): Promise<BTMCostRow[]> {
  const { data: opts } = await btmSupabase
    .from("btm_product_options")
    .select("id, product_id, option_code, option_name, selling_price, cost_price, labor_cost, total_cost, stock_quantity, is_active, is_manual_cost");

  const { data: prods } = await btmSupabase
    .from("btm_products")
    .select("product_id, product_name, sort_order")
    .order("sort_order", { ascending: true });

  const nameMap: Record<string, string> = {};
  const sortMap: Record<string, number> = {};
  const sortedProds = (prods?.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)) ?? []);
  for (const p of sortedProds) {
    nameMap[p.product_id] = p.product_name;
    sortMap[p.product_id] = p.sort_order ?? 0;
  }

  return (opts ?? []).map(o => ({
    ...o,
    product_name: nameMap[o.product_id] ?? o.product_id,
    sort_order: sortMap[o.product_id] ?? 0,
  })) as BTMCostRow[];
}

export async function updateLaborCost(
  optionId: number,
  laborCost: number
): Promise<{ ok: boolean; error?: string }> {
  // labor_cost 갱신 + total_cost 재계산
  const { data: opt } = await btmSupabase
    .from("btm_product_options")
    .select("cost_price")
    .eq("id", optionId)
    .single();

  const costPrice = (opt as { cost_price: number } | null)?.cost_price ?? 0;
  const { error } = await btmSupabase
    .from("btm_product_options")
    .update({
      labor_cost: laborCost,
      total_cost: costPrice + laborCost,
    })
    .eq("id", optionId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function updateCostPrice(
  optionId: number,
  costPrice: number,
  isManual = true
): Promise<{ ok: boolean; error?: string }> {
  const { data: opt } = await btmSupabase
    .from("btm_product_options")
    .select("labor_cost")
    .eq("id", optionId)
    .single();

  const laborCost = (opt as { labor_cost: number } | null)?.labor_cost ?? 0;

  const { error } = await btmSupabase
    .from("btm_product_options")
    .update({
      cost_price: costPrice,
      is_manual_cost: isManual,
      total_cost: costPrice + laborCost,
    })
    .eq("id", optionId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ── 옵션-부자재 연결 ─────────────────────────────────────────────

export interface BTMOptionMaterial {
  id: number;
  option_id: number | null;
  product_id?: string | null;
  material_id: number;
  quantity_per_unit: number;
  // join
  material_name?: string;
  material_unit?: string;
  material_category?: string;
  latest_price?: number; // btm_purchases에서 최근 단가
}

// 특정 옵션의 부자재 목록 조회
export async function getOptionMaterials(optionId: number): Promise<BTMOptionMaterial[]> {
  const { data } = await btmSupabase
    .from("btm_option_materials")
    .select("*")
    .eq("option_id", optionId)
    .order("id");
  return (data ?? []) as BTMOptionMaterial[];
}

// 옵션-부자재 연결 추가
export async function addOptionMaterial(
  optionId: number,
  materialId: number,
  quantityPerUnit: number
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await btmSupabase
    .from("btm_option_materials")
    .upsert(
      { option_id: optionId, material_id: materialId, quantity_per_unit: quantityPerUnit },
      { onConflict: "option_id,material_id" }
    );
  if (error) return { ok: false, error: error.message };

  // total_cost 재계산
  await recalcTotalCost(optionId);
  return { ok: true };
}

// 옵션-부자재 연결 삭제
export async function removeOptionMaterial(id: number, optionId: number): Promise<{ ok: boolean; error?: string }> {
  const { error } = await btmSupabase
    .from("btm_option_materials")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await recalcTotalCost(optionId);
  return { ok: true };
}

// total_cost 재계산 (cost_price + 부자재비 합계 + labor_cost)
export async function recalcTotalCost(optionId: number): Promise<void> {
  const { data: opt } = await btmSupabase
    .from("btm_product_options")
    .select("cost_price, labor_cost, product_id, is_manual_cost")
    .eq("id", optionId)
    .single();

  if (!opt) return;

  // 옵션별 부자재
  const { data: optLinks } = await btmSupabase
    .from("btm_option_materials")
    .select("material_id, quantity_per_unit")
    .eq("option_id", optionId);

  // 상품 공통 부자재
  const { data: prodLinks } = await btmSupabase
    .from("btm_option_materials")
    .select("material_id, quantity_per_unit")
    .eq("product_id", (opt as { product_id: string }).product_id)
    .is("option_id", null);

  const allLinks = [...(optLinks ?? []), ...(prodLinks ?? [])];

  // 부자재 단가는 btm_materials.unit_price에서 직접 조회
  let materialCost = 0;
  if (allLinks.length > 0) {
    const materialIds = allLinks.map(l => l.material_id);
    const { data: mats } = await btmSupabase
      .from("btm_materials")
      .select("id, unit_price")
      .in("id", materialIds);

    const priceMap: Record<number, number> = {};
    for (const m of mats ?? []) {
      priceMap[m.id] = m.unit_price ?? 0;
    }
    for (const link of allLinks) {
      materialCost += (priceMap[link.material_id] ?? 0) * Number(link.quantity_per_unit);
    }
  }

  const o = opt as { cost_price: number; labor_cost: number };
  const totalCost = (o.cost_price ?? 0) + materialCost + (o.labor_cost ?? 0);

  await btmSupabase
    .from("btm_product_options")
    .update({ total_cost: Math.round(totalCost) })
    .eq("id", optionId);
}

// ── 상품 공통 부자재 (product_id 기준, option_id = NULL) ─────────

export async function getProductMaterials(productId: string): Promise<BTMOptionMaterial[]> {
  const { data } = await btmSupabase
    .from("btm_option_materials")
    .select("*")
    .eq("product_id", productId)
    .is("option_id", null)
    .order("id");
  return (data ?? []) as BTMOptionMaterial[];
}

export async function addProductMaterial(
  productId: string,
  materialId: number,
  quantityPerUnit: number
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await btmSupabase
    .from("btm_option_materials")
    .insert({ product_id: productId, material_id: materialId, quantity_per_unit: quantityPerUnit, option_id: null });
  if (error) return { ok: false, error: error.message };

  // 해당 상품의 모든 옵션 total_cost 재계산
  const { data: opts } = await btmSupabase
    .from("btm_product_options")
    .select("id")
    .eq("product_id", productId);
  for (const opt of opts ?? []) {
    await recalcTotalCost(opt.id);
  }
  return { ok: true };
}

export async function removeProductMaterial(id: number, productId: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await btmSupabase
    .from("btm_option_materials")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  const { data: opts } = await btmSupabase
    .from("btm_product_options")
    .select("id")
    .eq("product_id", productId);
  for (const opt of opts ?? []) {
    await recalcTotalCost(opt.id);
  }
  return { ok: true };
}

// 부자재 최근 구매단가 조회
export async function getMaterialLatestPrice(materialId: number): Promise<number> {
  const { data } = await btmSupabase
    .from("btm_purchases")
    .select("final_unit_price")
    .eq("material_id", materialId)
    .eq("purchase_type", "material")
    .order("purchase_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { final_unit_price: number } | null)?.final_unit_price ?? 0;
}

// ── 상품 순서 변경 ────────────────────────────────────────────────
export async function updateProductSortOrder(
  productId: string,
  newSortOrder: number
): Promise<void> {
  await btmSupabase
    .from("btm_products")
    .update({ sort_order: newSortOrder })
    .eq("product_id", productId);
}

export async function getProductsSorted(): Promise<{ product_id: string; product_name: string; sort_order: number }[]> {
  const { data } = await btmSupabase
    .from("btm_products")
    .select("product_id, product_name, sort_order")
    .order("sort_order", { ascending: true })
    .order("product_name", { ascending: true });
  return (data ?? []) as { product_id: string; product_name: string; sort_order: number }[];
}
