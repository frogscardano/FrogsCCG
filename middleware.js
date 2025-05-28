import { NextResponse } from 'next/server';

export function middleware(request) {
  try {
    // Only apply middleware to API routes to avoid issues with static files
    if (request.nextUrl.pathname.startsWith('/api/')) {
      // Add CORS headers for API routes
      const response = NextResponse.next();
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return response;
    }
    
    // For all other routes, just continue
    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error:', error);
    // If middleware fails, just continue without it
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
