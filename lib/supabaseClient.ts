/**
 * Supabase 클라이언트 초기화
 *
 * - NEXT_PUBLIC_SUPABASE_URL  : Supabase 프로젝트 URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY : anon(public) 키  ← service_role 키는 절대 사용 금지
 *
 * 두 변수는 .env.local 에 설정합니다.
 * NEXT_PUBLIC_ 접두사 덕분에 브라우저(클라이언트 컴포넌트)에서도 안전하게 읽힙니다.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "[supabaseClient] 환경변수가 누락되었습니다.\n" +
      ".env.local 파일에 NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_ANON_KEY 를 설정해주세요."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
