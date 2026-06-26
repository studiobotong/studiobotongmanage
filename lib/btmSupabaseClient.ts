/**
 * BTM (BoTong Manage) 전용 Supabase 클라이언트
 *
 * 스튜디오 보통 관리 시스템 전용 새 Supabase 프로젝트에 연결합니다.
 * ASSET 영역은 기존 lib/supabaseClient.ts (supabase)를 계속 사용합니다.
 *
 * 환경변수:
 * - NEXT_PUBLIC_BTM_SUPABASE_URL
 * - NEXT_PUBLIC_BTM_SUPABASE_PUBLISHABLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const btmUrl = process.env.NEXT_PUBLIC_BTM_SUPABASE_URL ?? "";
const btmKey = process.env.NEXT_PUBLIC_BTM_SUPABASE_PUBLISHABLE_KEY ?? "";

if (!btmUrl || !btmKey) {
  console.warn(
    "[btmSupabaseClient] BTM 환경변수가 누락되었습니다.\n" +
      ".env.local 파일에 NEXT_PUBLIC_BTM_SUPABASE_URL 과 NEXT_PUBLIC_BTM_SUPABASE_PUBLISHABLE_KEY 를 설정해주세요."
  );
}

export const btmSupabase = createClient(
  btmUrl || "https://placeholder.supabase.co",
  btmKey || "placeholder"
);
