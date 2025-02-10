"use server";
import { authMiddleware } from '@descope/nextjs-sdk/server';
import { env } from '@/lib/constants';

export default  authMiddleware({
  projectId: env.DESCOPE_PROJECT_ID,
  redirectUrl: '/sign-on',
});

export const config = {
   matcher: ['/onboarding', '/onboarding/:path*', '/app/:path*'],
   
}