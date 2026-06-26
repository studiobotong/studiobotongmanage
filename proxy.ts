import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE = 'auth_session'

/**
 * 서버 라우트가 자기 자신에게 fetch할 때(예: /api/market-data/refresh → /api/price) 쿠키가
 * 전달되지 않으면 여기서 /login HTML로 리다이렉트되어 JSON 파싱이 깨집니다.
 * 시세·환율 API는 공개로 두어 인증 없는 서버 간 조회가 가능해야 합니다.
 */
function isPublicPriceOrMarketDataRead(pathname: string): boolean {
  if (pathname.startsWith('/api/price')) return true
  if (pathname === '/api/market-data') return true
  return false
}

function isAuthorizedCronRequest(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

export function proxy(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)
  const { pathname } = request.nextUrl
  const isLoginPage = pathname === '/login'

  if (!session && !isLoginPage && !isPublicPriceOrMarketDataRead(pathname) && !isAuthorizedCronRequest(request)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (session && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.svg$).*)'],
}
