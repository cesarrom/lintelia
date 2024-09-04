import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@descope/nextjs-sdk/server';
import { env } from '@fintivio-sst/core/constants';

const authMid = authMiddleware({
  projectId: env.DESCOPE_PROJECT_ID,
  redirectUrl: '/sign-on',
  publicRoutes: ['/sign-on', '/api/auth/callback', '/onboarding'],
});

export default function middleware(request: NextRequest) {
  // Store current request url in a custom header, which you can read later
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-url', request.url);

  const req = new NextRequest(request.url, {
    ...request,
    headers: requestHeaders,
  });

  return authMid(req);
}