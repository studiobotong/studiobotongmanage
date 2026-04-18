/**
 * lib/initialPortfolio.ts
 *
 * 2026-04-12 기준 초기 보유 자산 목록.
 * 단가는 당일 Yahoo Finance 실제 현재가를 사용 → 기준 시점 P&L = 0.
 * 이후 거래 내역을 추가하면서 포트폴리오를 업데이트합니다.
 *
 * 미국 주식: + 로 구분된 복수 계좌 합산 수량
 * 현금/채권: 단가 1, 수량 = 금액
 */

// 거래원장 구조 제거로 AssetTransactionInsert 타입 대신 plain object 사용.
// 이 데이터는 seed/page.tsx (현재 미사용)에서 참조합니다.

type PortfolioEntry = {
  trade_date: string;
  type: string;
  name: string;
  symbol: string;
  market: string;
  currency: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  fee: null;
  memo: string;
};

const INITIAL_DATE = "2026-04-12";
export const INITIAL_MEMO = "초기자산 설정";

export const INITIAL_PORTFOLIO: PortfolioEntry[] = [
  // ───────────────────────────────────────────
  // 한국 주식 (KRX · KRW) — 2026-04-12 Yahoo Finance 종가
  // ───────────────────────────────────────────
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "삼성전자",
    symbol: "005930",
    market: "KRX",
    currency: "KRW",
    quantity: 13,
    unit_price: 206000,
    total_amount: 2678000,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "SK하이닉스",
    symbol: "000660",
    market: "KRX",
    currency: "KRW",
    quantity: 2,
    unit_price: 1027000,
    total_amount: 2054000,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "삼성생명",
    symbol: "032830",
    market: "KRX",
    currency: "KRW",
    quantity: 60,
    unit_price: 234500,
    total_amount: 14070000,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "LIG넥스원",
    symbol: "079550",
    market: "KRX",
    currency: "KRW",
    quantity: 8,
    unit_price: 921000,
    total_amount: 7368000,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "삼양식품",
    symbol: "003230",
    market: "KRX",
    currency: "KRW",
    quantity: 6,
    unit_price: 1238000,
    total_amount: 7428000,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "현대모비스",
    symbol: "012330",
    market: "KRX",
    currency: "KRW",
    quantity: 8,
    unit_price: 402500,
    total_amount: 3220000,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "현대자동차",
    symbol: "005380",
    market: "KRX",
    currency: "KRW",
    quantity: 4,
    unit_price: 489500,
    total_amount: 1958000,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "한화에어로스페이스",
    symbol: "012450",
    market: "KRX",
    currency: "KRW",
    quantity: 4,
    unit_price: 1507000,
    total_amount: 6028000,
    fee: null,
    memo: INITIAL_MEMO,
  },

  // ───────────────────────────────────────────
  // 미국 주식 (NASDAQ/NYSE · USD) — 2026-04-12 Yahoo Finance 종가
  // 복수 계좌 수량 합산
  // ───────────────────────────────────────────
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "엔비디아",
    symbol: "NVDA",
    market: "NASDAQ",
    currency: "USD",
    quantity: 73,       // 54 + 19
    unit_price: 188.63,
    total_amount: 13769.99,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "이턴코퍼레이션",
    symbol: "ETN",
    market: "NYSE",
    currency: "USD",
    quantity: 4,        // 2 + 2
    unit_price: 403.0,
    total_amount: 1612.0,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "알파벳A",
    symbol: "GOOGL",
    market: "NASDAQ",
    currency: "USD",
    quantity: 30,       // 27 + 3
    unit_price: 317.24,
    total_amount: 9517.2,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "TSMC(ADR)",
    symbol: "TSM",
    market: "NYSE",
    currency: "USD",
    quantity: 9,        // 7 + 2
    unit_price: 370.6,
    total_amount: 3335.4,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "에머슨일렉트릭",
    symbol: "EMR",
    market: "NYSE",
    currency: "USD",
    quantity: 27,       // 15 + 12
    unit_price: 143.77,
    total_amount: 3881.79,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "팔란티어",
    symbol: "PLTR",
    market: "NASDAQ",
    currency: "USD",
    quantity: 10,
    unit_price: 128.06,
    total_amount: 1280.6,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "샌디스크",
    symbol: "SNDK",
    market: "NASDAQ",
    currency: "USD",
    quantity: 9,
    unit_price: 851.77,
    total_amount: 7665.93,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "메타",
    symbol: "META",
    market: "NASDAQ",
    currency: "USD",
    quantity: 2,
    unit_price: 629.86,
    total_amount: 1259.72,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "헌팅턴잉걸스",
    symbol: "HII",
    market: "NYSE",
    currency: "USD",
    quantity: 11,       // 9 + 2
    unit_price: 394.41,
    total_amount: 4338.51,
    fee: null,
    memo: INITIAL_MEMO,
  },

  // ───────────────────────────────────────────
  // 현금·채권 (수량 = 금액, 단가 = 1)
  // ───────────────────────────────────────────
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "한국예수금",
    symbol: "KRW_CASH",
    market: "ETC",
    currency: "KRW",
    quantity: 1387934,
    unit_price: 1,
    total_amount: 1387934,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "미국채권",
    symbol: "BOND_USD",
    market: "ETC",
    currency: "USD",
    // 1884.97 + 996.28 + 891.64 + 891.64
    quantity: 4664.53,
    unit_price: 1,
    total_amount: 4664.53,
    fee: null,
    memo: INITIAL_MEMO,
  },
  {
    trade_date: INITIAL_DATE,
    type: "BUY",
    name: "외화예수금",
    symbol: "USD_CASH",
    market: "ETC",
    currency: "USD",
    // 49.49 + 13.26 + 22.39
    quantity: 85.14,
    unit_price: 1,
    total_amount: 85.14,
    fee: null,
    memo: INITIAL_MEMO,
  },
];

/** 총 종목 수 (현금/채권 포함) */
export const INITIAL_PORTFOLIO_COUNT = INITIAL_PORTFOLIO.length;
