import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HonoAdapter } from "@kiyasov/platform-hono";
import { cors } from 'hono/cors'
import { env } from './constants';
import assert from 'assert';
import { auth } from './clients/auth.client';
import { encodeAuthorization } from '@repo/fintivio/utilities';
import { Hono } from 'hono';
import { proxyRequest, teeRequest } from './utils/request';

const SIG_EVENTS = [
  "beforeExit",
  "SIGHUP",
  "SIGINT",
  "SIGQUIT",
  "SIGILL",
  "SIGTRAP",
  "SIGABRT",
  "SIGBUS",
  "SIGFPE",
  "SIGUSR1",
  "SIGSEGV",
  "SIGUSR2",
  "SIGTERM",
  "uncaughtException",
  "unhandledRejection"
];

const port = env.PORT || 8000;

async function afterListen(stop: Function) {
  try {
    SIG_EVENTS.forEach((evt) => (process as any).on(evt, async (e: any) => {
      try {
        console.error(e);
        stop();
      } catch (e) {
        console.error(e);
      }
      process.exit(1);
    }));


    console.log('\x1b[36mSearching for user...\x1b[0m');
    const usersResponse = await auth.management.user.search({
      emails: ['admin@example.com'],
    });
    const [user] = usersResponse.data || [];
    assert(user, 'User not found');
    console.log('\x1b[32mUser found:\x1b[0m', user.email);

    const [loginId] = user.loginIds || [];
    assert(loginId, 'Login id not found');
    console.log('\x1b[32mLogin ID found:\x1b[0m', loginId);

    console.log('\x1b[36mSigning in to obtain JWT...\x1b[0m');
    const jwtResponse = await auth.management.jwt.signIn(loginId);
    const jwt = jwtResponse.data?.sessionJwt;
    assert(jwt, 'JWT not found');
    console.log('\x1b[32mJWT obtained successfully\x1b[0m');

    console.log(`\x1b[36mDeploying ${env.HOST} to Restate admin endpoint...\x1b[0m`);
    const response = await fetch(`${env.RESTATE_ADMIN_ENDPOINT}/deployments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({
        uri: `${env.HOST}/restate`,
        force: true,
        use_http_11: true,
        additional_headers: {
          'register-key': encodeAuthorization({ token: jwt })
        }
      })
    }) as Response;

    if (!response.ok) {
      console.error('\x1b[31mFailed to deploy to Restate admin endpoint\x1b[0m');
      throw new Error(
        await response.text()
      )
    } else {
      console.log('\x1b[32mDeployment request sent successfully\x1b[0m');
    }
  } catch (error: any) {
    console.error(error);
    stop();
    // $log.error({ event: "SERVER_BOOTSTRAP_ERROR", message: error.message, stack: error.stack });
    // process.exit(1);
  }
}

async function bootstrap() {
  const adapter = new HonoAdapter();
  const hono: Hono = adapter.getInstance();
  hono.use(cors()).use(async (ctx, next) => {
    console.group(`\x1b[33m${ctx.req.url}\x1b[0m`);
    
    ctx.req.raw = await proxyRequest(ctx.req.raw);

    await next();
    console.groupEnd();
    console.log(`\x1b[33m${ctx.res.status}\x1b[0m`);
  });
  const nest = await NestFactory.create(AppModule, adapter as any);
  nest.listen(port, async () => {
    console.log('listening on port ', port);
    return afterListen(nest.close);
  })
}

await bootstrap();
