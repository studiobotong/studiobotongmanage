/**
 * Supabase 클라이언트 초기화
 *
 * - NEXT_PUBLIC_SUPABASE_URL            : Supabase 프로젝트 URL
 * - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 공개(anon) 키
 *
 * 두 변수는 .env.local 에 설정합니다.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    "[supabaseClient] 환경변수가 누락되었습니다.\n" +
      ".env.local 파일에 NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 를 설정해주세요."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabasePublishableKey || "placeholder"
);
