export type DashboardTabId = "home" | "sales" | "marketing";

export type DateFilterGranularity = "year" | "month" | "day";

export interface DateFilterValue {
  granularity: DateFilterGranularity;
  year: number;
  month: number;
  day: number;
}

export interface SalesKpi {
  totalSales: number;
  totalProfit: number;
  orderCount: number;
  avgOrderAmount: number;
  salesChangePct: number | null;
  profitChangePct: number | null;
  orderCountChangePct: number | null;
  avgOrderChangePct: number | null;
}

export interface SalesBarPoint {
  label: string;
  sales: number;
  key: string;
}

export interface SalesTopProduct {
  rank: number;
  productName: string;
  orderCount: number;
  totalSales: number;
  totalProfit?: number;
}

export interface SalesCategorySlice {
  category: string;
  sales: number;
  pct: number;
}

export interface SalesWeeklyPoint {
  weekday: string;
  orderCount: number;
  sales: number;
}

export interface SalesTabData {
  kpi: SalesKpi;
  trend: SalesBarPoint[];
  topProducts: SalesTopProduct[];
  categories: SalesCategorySlice[];
  weekly: SalesWeeklyPoint[];
}

export interface TopProductsPeriodFilter {
  year: number;
  startMonth: number;
  endMonth: number;
}
