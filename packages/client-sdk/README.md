# @fintivio/client-sdk

Put your Fintivio **client app** (the app you build in *Build → Client app*) inside your own web site or mobile
app, or drive its API from your own screens. Background: [docs/changes/0007](../../docs/changes/0007-client-apps.md).

## 1. Your backend opens a client session

With an API client that has `clients:provision` (*Build → API clients*), for the customer signed in to your site:

```ts
// POST https://<api>/client-sessions   Authorization: Bearer <API client token>
const response = await fetch(`${FINTIVIO_API}/client-sessions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiClientToken}` },
  body: JSON.stringify({ externalId: customer.id, email: customer.email, name: customer.name, attributes: { tier: customer.tier } }),
});
const { clientSecret } = await response.json(); // single use, valid 5 minutes — hand it to your front end
```

The client is found by your `externalId` (or by e-mail, when the app links by e-mail) or created; new clients start
the workflows listening to `client.registered`. Push what the app shows with the records API
(`PUT /clients/ext:<externalId>/records/<collection>/<key>`).

Alternatively, let the app accept tokens of your identity provider (*Client app → Settings → Identity*) and pass
`fetchSubjectToken` instead of `fetchClientSecret`.

## 2. Your front end mounts the app

```ts
import { mount } from '@fintivio/client-sdk';

const app = mount('#banking', {
  appUrl: 'https://app.your-bank.com',            // your custom domain, or your Fintivio host
  fetchClientSecret: () => fetch('/api/fintivio-session', { method: 'POST' }).then((r) => r.json()).then((b) => b.clientSecret),
  page: 'accounts',                                // optional first page
  chrome: 'full',                                  // 'none': content only, the frame grows with it
  onEvent: (event) => console.log(event.name, event.detail), // journey.started, journey.completed, page.viewed, signed-out
});

app.navigate('cards');
app.startJourney('card_freeze', { card: 'card-1' });
```

Without a bundler: `<script src="https://app.your-bank.com/fintivio-client.js"></script>` then
`FintivioClient.mount(...)`.

Add your site to *Client app → Settings → Embedding* first: the app only renders inside the sites listed there
(`frame-ancestors`) and only talks to them.

### React

```tsx
import { FintivioApp } from '@fintivio/client-sdk/react';

<FintivioApp appUrl="https://app.your-bank.com" fetchClientSecret={getSecret} page="home" style={{ height: 760 }} />
```

### React Native (WebView)

```tsx
import { FintivioAppView } from '@fintivio/client-sdk/react-native'; // peer: react-native-webview

<FintivioAppView appUrl="https://app.your-bank.com" fetchClientSecret={getSecret} style={{ flex: 1 }} />
```

## 3. Or build your own screens (headless)

```ts
import { createClient } from '@fintivio/client-sdk';

const client = createClient({ apiUrl: 'https://api.fintivio.com', tenant: 'your-bank', fetchClientSecret: getSecret });
const { me, records } = await client.data(['me', 'records:accounts']);
const journey = await client.startJourney('transfer');
await client.submitScreen(journey.case.id, journey.screen.taskId, 'continue', { fromAccount: 'cur-1', toAccount: 'sav-1', amount: 50 });
```

React hooks: `FintivioProvider`, `useAppData(sources)`, `useJourney(caseId)` from `@fintivio/client-sdk/react`.

## Security

- The client secret is single use and expires after 5 minutes; the app stores its session in the tab only.
- Messages between your page and the app are checked both ways (origin and sender).
- The app reads only the data sources the published app declares, for the signed-in client only; journeys check
  eligibility on the server.

## Development

`bun test` (jsdom) covers the embed protocol and the headless client.

## Live updates

Your own screens can follow what changes, as it happens (Server-Sent Events, docs/changes/0014):

```ts
const client = createClient({ apiUrl, tenant: 'your-bank', fetchClientSecret });
const me = (await client.signIn()).user.userId;

// Balances, notifications, applications: "changed" → fetch again with client.data(...)
const live = client.subscribe([`client/${me}/records/*`, `client/${me}/notifications`, `client/${me}/cases`], (event) => {
  if (event.type === 'change') refresh(event.topic);
});

// What a journey's workflow publishes while it works (its start answer says where to listen), from the start:
const started = await client.startJourney<{ case: { id: string }; live: { topics: string[] } }>('open_account');
client.subscribe(started.live.topics, (event) => {
  if (event.type === 'message') showProgress(event.payload.text);
}, { replay: true });

live.close();
```

`EventSource` works too: `POST /live/tickets` (with the client's token) gives a single-use URL
(`/live?ticket=…&topics=…`).
