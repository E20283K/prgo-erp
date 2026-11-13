import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { validateSession } from './lib/server/authService';

const intlMiddleware = createMiddleware(routing);

const SESSION_COOKIE = 'printgoo_session';

// Login talab qilmaydigan API yo'llari. Webhook'lar o'z route'ida secret bilan tekshiriladi.
const PUBLIC_API_PATHS = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/logout',
  '/api/v1/health',
  '/api/v1/hr/attendance/hikvision-event',
  '/api/telegram/webhook',
]);

function unauthorized(message: string) {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}

async function guardApi(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dev vositalari (manba kodni o'qish) production'da mavjud emas
  if (pathname.startsWith('/api/dev/') && process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }

  if (PUBLIC_API_PATHS.has(pathname) || request.method === 'OPTIONS') {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');
  const token =
    request.cookies.get(SESSION_COOKIE)?.value ||
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);

  if (!token) return unauthorized('Aktiv sessiya topilmadi');

  try {
    const user = await validateSession(token);
    if (!user) return unauthorized('Sessiya muddati tugagan yoki yaroqsiz');
  } catch (error) {
    console.error('[proxy] Sessiyani tekshirishda xato:', error);
    return NextResponse.json({ success: false, error: 'Sessiyani tekshirib bo\'lmadi' }, { status: 503 });
  }

  return NextResponse.next();
}

export default async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return guardApi(request);
  }
  return intlMiddleware(request);
}

export const config = {
  matcher: ['/', '/(ru|en|uz|tr)/:path*', '/api/:path*'],
};
