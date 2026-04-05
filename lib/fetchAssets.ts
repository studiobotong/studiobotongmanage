export interface AssetItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  purchasePrice: number;
  currentPrice: number;
  evaluationAmount: number;
  purchaseAmount: number;
  profitLoss: number;
  returnRate: number;
  note: string;
}

export interface AssetData {
  items: AssetItem[];
  totalEvaluation: number;
  totalPurchase: number;
  totalProfitLoss: number;
  totalReturnRate: number;
  assetCount: number;
}

const SHEET_ID = "10moIKFgk7_EnHuCSrZflQQjOS7XB6UCe6nc06-Yfz5s";
const SHEET_GID = "588556660";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

/** Minimal RFC-4180 CSV parser – handles quoted fields with embedded commas/newlines */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
      } else if (ch === '"') {
        inQuotes = false;
        i++;
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        row.push(field.trim());
        field = "";
        i++;
      } else if (ch === "\r" && text[i + 1] === "\n") {
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = "";
        i += 2;
      } else if (ch === "\n" || ch === "\r") {
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = "";
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  if (field || row.length) {
    row.push(field.trim());
    if (row.some((c) => c !== "")) rows.push(row);
  }

  return rows;
}

function findColIndex(headers: string[], ...keywords: string[]): number {
  const norm = headers.map((h) => h.replace(/\s/g, "").toLowerCase());
  for (let i = 0; i < norm.length; i++) {
    if (keywords.some((k) => norm[i].includes(k.toLowerCase()))) return i;
  }
  return -1;
}

function toNumber(v: string | undefined): number {
  if (!v) return 0;
  const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? 0 : n;
}

export async function fetchAssetData(): Promise<AssetData> {
  const res = await fetch(CSV_URL, {
    next: { revalidate: 300 },
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    throw new Error(
      `스프레드시트 응답 오류 (HTTP ${res.status}). 시트가 공개 공유 상태인지 확인하세요.`
    );
  }

  const text = await res.text();
  if (!text.trim()) throw new Error("빈 응답이 반환되었습니다.");

  const allRows = parseCSV(text);
  if (allRows.length < 2) throw new Error("데이터가 충분하지 않습니다 (헤더+1행 이상 필요).");

  // First row is header
  const headers = allRows[0];
  const dataRows = allRows.slice(1);

  const iName     = findColIndex(headers, "종목명", "자산명", "종목", "자산", "name");
  const iCategory = findColIndex(headers, "유형", "분류", "카테고리", "category", "type");
  const iQty      = findColIndex(headers, "보유수량", "수량", "qty", "quantity");
  const iBuyPrice = findColIndex(headers, "매입단가", "평균단가", "매수가", "매입가", "단가", "buyprice");
  const iCurPrice = findColIndex(headers, "현재가", "현재시세", "시가", "현재", "curprice", "price");
  const iEval     = findColIndex(headers, "평가금액", "평가액", "eval");
  const iBuyAmt   = findColIndex(headers, "매입금액", "투자금액", "원금", "매수금액", "buyamount");
  const iPL       = findColIndex(headers, "손익", "평가손익", "수익금");
  const iRR       = findColIndex(headers, "수익률", "등락률", "returnrate", "rate");
  const iNote     = findColIndex(headers, "메모", "비고", "note", "remark");

  const items: AssetItem[] = [];

  for (let ri = 0; ri < dataRows.length; ri++) {
    const cols = dataRows[ri];
    if (!cols || cols.every((c) => !c)) continue;

    const name = iName >= 0 ? (cols[iName] ?? "").trim() : "";
    if (!name) continue;

    const quantity      = toNumber(cols[iQty]);
    const purchasePrice = toNumber(cols[iBuyPrice]);
    const currentPrice  = toNumber(cols[iCurPrice]);
    const category      = iCategory >= 0 ? (cols[iCategory] ?? "").trim() : "";

    let evaluationAmount = toNumber(cols[iEval]);
    let purchaseAmount   = toNumber(cols[iBuyAmt]);
    let profitLoss       = toNumber(cols[iPL]);
    let returnRate       = toNumber(cols[iRR]);

    // Derive missing computed fields
    if (!evaluationAmount && quantity && currentPrice)  evaluationAmount = quantity * currentPrice;
    if (!purchaseAmount   && quantity && purchasePrice) purchaseAmount   = quantity * purchasePrice;
    if (!profitLoss       && evaluationAmount && purchaseAmount) profitLoss = evaluationAmount - purchaseAmount;
    if (!returnRate       && purchaseAmount)            returnRate       = (profitLoss / purchaseAmount) * 100;

    const note = iNote >= 0 ? (cols[iNote] ?? "").trim() : "";

    items.push({
      id: `asset-${ri}`,
      name,
      category,
      quantity,
      purchasePrice,
      currentPrice,
      evaluationAmount,
      purchaseAmount,
      profitLoss,
      returnRate,
      note,
    });
  }

  if (items.length === 0) {
    return { items: [], totalEvaluation: 0, totalPurchase: 0, totalProfitLoss: 0, totalReturnRate: 0, assetCount: 0 };
  }

  const totalEvaluation  = items.reduce((s, i) => s + i.evaluationAmount, 0);
  const totalPurchase    = items.reduce((s, i) => s + i.purchaseAmount, 0);
  const totalProfitLoss  = totalEvaluation - totalPurchase;
  const totalReturnRate  = totalPurchase > 0 ? (totalProfitLoss / totalPurchase) * 100 : 0;

  return { items, totalEvaluation, totalPurchase, totalProfitLoss, totalReturnRate, assetCount: items.length };
}
