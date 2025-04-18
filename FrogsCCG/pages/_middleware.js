import { NextResponse } from 'next/server';

export function middleware(request) {
  // Continue to the requested page
  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
}; 