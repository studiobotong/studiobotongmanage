import type {
  SalesBarPoint,
  SalesCategorySlice,
  SalesTopProduct,
  SalesWeeklyPoint,
} from "./dashboardSales";

export type HomePeriodPreset =
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "custom";

export interface HomePeriodFilter {
  preset: HomePeriodPreset;
  startDate: string;
  endDate: string;
}

export interface DashboardKpi {
  periodSales: number;
  periodSalesChangePct: number | null;
  periodProfit: number;
  periodProfitChangePct: number | null;
  orderCount: number;
  orderCountChangePct: number | null;
  productCount: number;
  productCountDelta: number;
  avgOrderAmount: number;
  avgOrderChangePct: number | null;
  adSpend: number;
  adSpendChangePct: number | null;
  reorderProductCount: number;
}

export interface DashboardHomeData {
  kpi: DashboardKpi;
  topProducts: SalesTopProduct[];
  periodLabel: string;
}

export interface DashboardData extends DashboardHomeData {
  categories: SalesCategorySlice[];
  weekly: SalesWeeklyPoint[];
}

export interface DashboardReorderItem {
  productName: string;
  optionName: string;
  stockQty: number;
  safetyStock: number;
  shortage: number;
}

export type { SalesBarPoint };
