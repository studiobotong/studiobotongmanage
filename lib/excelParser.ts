/**
 * lib/excelParser.ts
 *
 * 엑셀 시트 파서 — CASHFLOW / SNAPSHOT 시트를 읽어 앱 타입으로 변환합니다.
 *
 * 지원 헤더 (실제 엑셀 기준):
 *   CASHFLOW : 날짜 / 구분 / 금액(KRW) / 계좌 / 비고
 *   SNAPSHOT : 날짜 / 총자산(KRW) / 순투자금(KRW) / 수익(KRW) / 수익률 /
 *              키움(KRW) / 메리츠(KRW) / 삼성(KRW) / 키움와이프(KRW) / 비고
 */

import * as XLSX from "xlsx";
import type { Cashflow, CashflowType, AssetSnapshot } from "@/types/assets";

// ─────────────────────────────────────────────────────────────
// 헤더 정규화
// ─────────────────────────────────────────────────────────────

/**
 * 컬럼 키를 정규화합니다.
 * - 소문자 변환
 * - 공백 제거
 * - 괄호와 괄호 안 내용 제거: "금액(KRW)" → "금액", "수익률(%)" → "수익률"
 */
function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/\(.*?\)/g, "");   // (KRW), (%), (원) 등 제거
}

/**
 * row 객체에서 후보 컬럼명 중 첫 번째 매칭 값을 반환합니다.
 * 헤더 비교 시 양쪽 모두 normalizeKey 를 적용합니다.
 */
function pick(row: Record<string, unknown>, candidates: string[]): unknown {
  // row 키 → 정규화된 키 역방향 맵 구성
  const normMap: Record<string, string> = {};
  for (const k of Object.keys(row)) {
    normMap[normalizeKey(k)] = k;
  }

  for (const c of candidates) {
    const orig = normMap[normalizeKey(c)];
    if (orig !== undefined) return row[orig];
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────
// 타입 변환 유틸
// ─────────────────────────────────────────────────────────────

/**
 * 엑셀 날짜 시리얼 / JS Date / 문자열을 YYYY-MM-DD 로 변환합니다.
 * cellDates: true 로 읽으면 Date 객체로 오고,
 * cellDates: false 로 읽으면 숫자 시리얼로 옵니다.
 */
function toDateString(raw: unknown): string {
  if (raw == null || raw === "") return "";

  // JS Date 객체 (cellDates: true 시)
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return "";
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, "0");
    const d = String(raw.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // 엑셀 날짜 시리얼 (숫자)
  if (typeof raw === "number") {
    // serial 25569 = 1970-01-01, 하루 = 86400초
    const MS_PER_DAY = 86400000;
    const EXCEL_EPOCH = new Date(Date.UTC(1900, 0, 1)).getTime() - 2 * MS_PER_DAY;
    const ms = EXCEL_EPOCH + raw * MS_PER_DAY;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dy = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${mo}-${dy}`;
    }
  }

  const s = String(raw).trim();
  if (!s) return "";

  // 이미 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // YYYY/MM/DD 또는 YYYY.MM.DD
  const normalized = s.replace(/[./]/g, "-");
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  // 마지막 시도
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return s;
}

/**
 * 숫자 변환. 수식 오류 셀("#VALUE!" 등)은 null 반환.
 */
function toNumber(raw: unknown): number | null {
  if (raw == null || raw === "") return null;

  // 수식 오류 객체
  if (typeof raw === "object" && raw !== null && "t" in raw) return null;

  if (typeof raw === "number") {
    return isFinite(raw) ? raw : null;
  }
  if (typeof raw === "string") {
    if (raw.startsWith("#")) return null;                       // #VALUE!, #N/A 등
    const cleaned = raw.replace(/[,원\s]/g, "").replace(/%$/, "");
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }
  return null;
}

function toStr(raw: unknown): string {
  if (raw == null) return "";
  return String(raw).trim();
}

// ─────────────────────────────────────────────────────────────
// CASHFLOW 파서
// ─────────────────────────────────────────────────────────────

/**
 * 구분 값 표준화
 *
 * 직접 매핑:
 *   입금              → DEPOSIT
 *   출금              → WITHDRAW
 *   배당금입금         → DIVIDEND
 *   이용료입금         → DEPOSIT  (원본 memo 보존)
 *   ISA개설 지원금 입금 → DEPOSIT  (원본 memo 보존)
 *   이체입금           → DEPOSIT  (원본 memo 보존)
 *   기타              → DEPOSIT  (원본 memo 보존)
 *
 * Returns [mappedType, isTrivial]
 *   isTrivial: true면 원본 구분 텍스트를 memo에 별도 보존할 필요 없음
 */
function normalizeCashflowType(raw: string): [CashflowType, boolean] {
  const s = raw.trim();
  const n = s.toUpperCase().replace(/\s/g, "");

  if (n === "입금"    || n === "DEPOSIT")  return ["DEPOSIT",  true];
  if (n === "출금"    || n === "WITHDRAW") return ["WITHDRAW", true];
  if (n === "배당"    || n === "DIVIDEND") return ["DIVIDEND", true];

  // 배당 계열
  if (n.includes("배당")) return ["DIVIDEND", false];

  // 그 외 모든 값 → DEPOSIT, memo 보존
  return ["DEPOSIT", false];
}

/**
 * CASHFLOW 시트 → Cashflow[]
 *
 * 실제 헤더: 날짜 / 구분 / 금액(KRW) / 계좌 / 비고
 */
export function parseCashflowSheet(sheet: XLSX.WorkSheet): Cashflow[] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });

  const now = new Date().toISOString();
  const result: Cashflow[] = [];

  for (const row of rows) {
    const raw_date   = pick(row, ["날짜", "date", "거래일자", "일자", "거래일", "기준일"]);
    const raw_amount = pick(row, ["금액(KRW)", "금액", "amount", "거래금액", "입출금액"]);
    const raw_type   = pick(row, ["구분", "type", "입출금구분", "유형"]);
    const raw_acct   = pick(row, ["계좌", "account", "계좌명", "증권사"]);
    const raw_memo   = pick(row, ["비고", "memo", "메모", "내용", "설명"]);
    const raw_curr   = pick(row, ["통화", "currency"]);

    const dateStr = toDateString(raw_date);
    const amount  = toNumber(raw_amount);

    // 날짜 또는 금액이 없는 행(헤더 반복 행, 소계 행 등) 건너뜀
    if (!dateStr || amount === null || amount === 0) continue;

    const rawTypeStr  = toStr(raw_type);
    const rawMemoStr  = toStr(raw_memo);
    const [cfType, isTrivial] = rawTypeStr
      ? normalizeCashflowType(rawTypeStr)
      : ["DEPOSIT" as CashflowType, true];

    // 비자명 구분값(이용료입금, 이체입금 등)은 원본을 memo 앞에 보존
    const memoStr = (!isTrivial && rawTypeStr)
      ? [rawTypeStr, rawMemoStr].filter(Boolean).join(" | ") || undefined
      : rawMemoStr || undefined;

    result.push({
      id:         "",
      flow_date:  dateStr,
      type:       cfType,
      amount:     Math.abs(amount),
      account:    toStr(raw_acct) || undefined,
      currency:   toStr(raw_curr) || undefined,
      memo:       memoStr,
      created_at: now,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// SNAPSHOT 파서
// ─────────────────────────────────────────────────────────────

/**
 * SNAPSHOT 시트 → AssetSnapshot[]
 *
 * 실제 헤더:
 *   날짜 / 총자산(KRW) / 순투자금(KRW) / 수익(KRW) / 수익률 /
 *   키움(KRW) / 메리츠(KRW) / 삼성(KRW) / 키움와이프(KRW) / 비고
 *
 * 수식 셀 처리: raw: false 로 한 번 더 읽어 포맷된 문자열에서 숫자를 추출합니다.
 */
export function parseSnapshotSheet(sheet: XLSX.WorkSheet): AssetSnapshot[] {
  // raw: true  — 숫자·날짜를 원래 값으로
  // raw: false — 수식 결과가 포맷된 문자열로 오므로 두 결과를 병합해서 사용
  const rowsRaw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
  });
  const rowsFmt = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });

  const result: AssetSnapshot[] = [];

  for (let i = 0; i < rowsRaw.length; i++) {
    const rowR = rowsRaw[i];
    const rowF = rowsFmt[i] ?? {};

    /** raw 값이 수식 오류이거나 null이면 fmt 값으로 폴백 */
    function bestValue(key: string): unknown {
      const r = pick(rowR, [key]);
      const f = pick(rowF, [key]);
      if (r == null || (typeof r === "object" && r !== null)) return f;
      if (typeof r === "string" && r.startsWith("#")) return f;
      return r;
    }

    const raw_date  = bestValue("날짜") ?? pick(rowR, ["date", "기준일", "일자", "snapshot_date"]);
    const raw_total = bestValue("총자산(KRW)") ?? bestValue("총자산") ?? bestValue("total_asset");
    const raw_net   = bestValue("순투자금(KRW)") ?? bestValue("순투자금") ?? bestValue("net_investment");
    const raw_pft   = bestValue("수익(KRW)") ?? bestValue("수익") ?? bestValue("profit");
    const raw_rr    = bestValue("수익률") ?? bestValue("return_rate");

    const dateStr = toDateString(raw_date);
    const total   = toNumber(raw_total);

    // 날짜 또는 총자산이 없으면 건너뜀
    if (!dateStr || total === null || total === 0) continue;

    const snap: AssetSnapshot = {
      id:             "",
      snapshot_date:  dateStr,
      total_asset:    total,
      created_at:     new Date().toISOString(),
    };

    const net = toNumber(raw_net);
    if (net !== null) snap.net_investment = net;

    const pft = toNumber(raw_pft);
    if (pft !== null) snap.profit = pft;

    const rr = toNumber(raw_rr);
    if (rr !== null) snap.return_rate = rr;

    result.push(snap);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// 워크북 파서 (진입점)
// ─────────────────────────────────────────────────────────────

export interface ParseResult {
  cashflows: Cashflow[];
  snapshots: AssetSnapshot[];
  errors: string[];
}

/**
 * ArrayBuffer(.xlsx 파일 내용)를 받아 CASHFLOW / SNAPSHOT 시트를 파싱합니다.
 * 시트명은 정확히 "CASHFLOW", "SNAPSHOT" (대소문자 무관) 으로 찾습니다.
 */
export function parseWorkbook(buffer: ArrayBuffer): ParseResult {
  const errors: string[] = [];
  let cashflows: Cashflow[] = [];
  let snapshots: AssetSnapshot[] = [];

  const wb = XLSX.read(buffer, {
    type:      "array",
    cellDates: true,   // 날짜 셀 → JS Date 자동 변환
    cellNF:    false,
    cellText:  false,
  });

  // 시트명 → 정규화(대문자 + 공백제거) 매핑
  const sheetMap = wb.SheetNames.reduce<Record<string, string>>((acc, name) => {
    acc[name.toUpperCase().replace(/\s/g, "")] = name;
    return acc;
  }, {});

  // ── CASHFLOW 시트 ──
  const cfKey = sheetMap["CASHFLOW"];
  if (cfKey) {
    try {
      cashflows = parseCashflowSheet(wb.Sheets[cfKey]);
      if (cashflows.length === 0) {
        errors.push(
          `CASHFLOW 시트에서 유효한 데이터를 찾지 못했습니다. ` +
          `헤더 행 확인: 날짜, 구분, 금액(KRW), 계좌, 비고`
        );
      }
    } catch (e) {
      errors.push(
        `CASHFLOW 파싱 오류: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  } else {
    errors.push(
      `CASHFLOW 시트를 찾을 수 없습니다. ` +
      `발견된 시트: [${wb.SheetNames.join(", ")}]`
    );
  }

  // ── SNAPSHOT 시트 ──
  const snapKey = sheetMap["SNAPSHOT"];
  if (snapKey) {
    try {
      snapshots = parseSnapshotSheet(wb.Sheets[snapKey]);
      if (snapshots.length === 0) {
        errors.push(
          `SNAPSHOT 시트에서 유효한 데이터를 찾지 못했습니다. ` +
          `헤더 행 확인: 날짜, 총자산(KRW), 순투자금(KRW), 수익(KRW), 수익률`
        );
      }
    } catch (e) {
      errors.push(
        `SNAPSHOT 파싱 오류: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  } else {
    errors.push(
      `SNAPSHOT 시트를 찾을 수 없습니다. ` +
      `발견된 시트: [${wb.SheetNames.join(", ")}]`
    );
  }

  return { cashflows, snapshots, errors };
}
