import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Keep a single physical route on Windows. Exact case avoids redirecting /org to itself.
  if (request.nextUrl.pathname === '/ORG') {
    const target = request.nextUrl.clone();
    target.pathname = '/org';
    return NextResponse.redirect(target, 308);
  }
  return NextResponse.next();
}
export const config = { matcher: '/ORG' };
