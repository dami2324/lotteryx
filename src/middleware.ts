import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authRateLimit, apiRateLimit } from '@/lib/ratelimit';

export async function middleware(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? '127.0.0.1';
  const path = request.nextUrl.pathname;

  // Protect authentication endpoints against brute force
  if (path === '/api/login' || path === '/api/register') {
    const { success, limit, reset, remaining } = await authRateLimit.limit(ip);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          }
        }
      );
    }
  }

  // Protect generic API endpoints against spam/scraping
  if (path.startsWith('/api/') && path !== '/api/login' && path !== '/api/register') {
    const { success, limit, reset, remaining } = await apiRateLimit.limit(ip);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Límite de peticiones excedido.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          }
        }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
