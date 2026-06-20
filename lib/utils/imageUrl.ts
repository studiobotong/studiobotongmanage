/**
 * 네이버 상품 이미지 등 외부 이미지 URL을 https로 강제 변환한다.
 * http://shop1.phinf.naver.net/... → https://shop1.phinf.naver.net/...
 * 이미 https거나 빈 값이면 그대로 반환한다.
 */
export function toHttpsImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http://")) {
    return url.replace("http://", "https://");
  }
  return url;
}
