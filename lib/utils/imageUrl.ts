/**
 * 네이버 상품 이미지 URL을 배포 환경에서도 정상 로드되는 형태로 정규화한다.
 * - shop1.phinf.naver.net (구버전, https 인증서 불일치로 ERR_CERT_COMMON_NAME_INVALID 발생)
 *   → shop-phinf.pstatic.net (정식 CDN 도메인, https 정상 지원)으로 치환
 * - http:// 는 https:// 로 변환
 * - 이미 정상 도메인/https면 그대로 반환
 */
export function normalizeNaverImageUrl(url: string | null | undefined): string {
  if (!url) return "";

  let result = url;

  // 1) 레거시 도메인(phinf.naver.net 계열)을 정식 도메인(phinf.pstatic.net 계열)으로 치환
  //    shop1.phinf.naver.net, shop2.phinf.naver.net 등 숫자 변형 모두 대응
  result = result.replace(
    /shop\d*\.phinf\.naver\.net/,
    "shop-phinf.pstatic.net"
  );

  // 2) http -> https
  if (result.startsWith("http://")) {
    result = result.replace("http://", "https://");
  }

  return result;
}

/** @deprecated normalizeNaverImageUrl 사용 */
export function toHttpsImageUrl(url: string | null | undefined): string {
  return normalizeNaverImageUrl(url);
}
