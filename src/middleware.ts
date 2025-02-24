
import { authMiddleware } from '@descope/nextjs-sdk/server';
import { env } from '@/lib/constants';

export default  authMiddleware({
  projectId: env.DESCOPE_PROJECT_ID,
  redirectUrl: '/sign-on',
  publicRoutes: ['/sign-on', '/'],
});

export const config = {
   matcher: ['/((?!.+\\.[\\w]+$|_next|workflows/v1/).*)', '/', '/(api|trpc)(.*)'],
}