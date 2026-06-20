import { supabase } from "./supabaseClient";

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const { data, error } = await supabase
    .from("botong_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error || data?.value === undefined || data?.value === null) {
    return defaultValue;
  }

  return data.value as T;
}

export async function isAutoDeductStockEnabled(): Promise<boolean> {
  return getSetting("auto_deduct_stock", true);
}
