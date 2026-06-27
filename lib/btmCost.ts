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
  return (data ?? []) as BTMPurchase[];
}

export async function createPurchase(
  values: Omit<BTMPurchase, "id" | "final_unit_price" | "created_at" | "supplier_name" | "product_name" | "option_name" | "material_name">
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await btmSupabase.from("btm_purchases").insert(values);
  if (error) return { ok: false, error: error.message };

  // 구매 후 원가 자동 갱신
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
    ? Math.round((purchase.unit_price * purchase.quantity + totalExtra) / purchase.quantity)
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
    .select("id, product_id, option_code, option_name, selling_price, cost_price, labor_cost, total_cost, stock_quantity, is_active");

  const { data: prods } = await btmSupabase
    .from("btm_products")
    .select("product_id, product_name");

  const nameMap: Record<string, string> = {};
  for (const p of prods ?? []) nameMap[p.product_id] = p.product_name;

  return (opts ?? []).map(o => ({
    ...o,
    product_name: nameMap[o.product_id] ?? o.product_id,
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

// ── 옵션-부자재 연결 ─────────────────────────────────────────────

export interface BTMOptionMaterial {
  id: number;
  option_id: number;
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
  // 옵션 기본 정보
  const { data: opt } = await btmSupabase
    .from("btm_product_options")
    .select("cost_price, labor_cost")
    .eq("id", optionId)
    .single();

  if (!opt) return;

  // 연결된 부자재 목록
  const { data: links } = await btmSupabase
    .from("btm_option_materials")
    .select("material_id, quantity_per_unit")
    .eq("option_id", optionId);

  let materialCost = 0;
  for (const link of links ?? []) {
    // 해당 부자재의 최근 구매단가
    const { data: purchase } = await btmSupabase
      .from("btm_purchases")
      .select("final_unit_price")
      .eq("material_id", link.material_id)
      .eq("purchase_type", "material")
      .order("purchase_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const price = (purchase as { final_unit_price: number } | null)?.final_unit_price ?? 0;
    materialCost += price * Number(link.quantity_per_unit);
  }

  const totalCost = (opt.cost_price ?? 0) + materialCost + (opt.labor_cost ?? 0);

  await btmSupabase
    .from("btm_product_options")
    .update({ total_cost: Math.round(totalCost) })
    .eq("id", optionId);
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
