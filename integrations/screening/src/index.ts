import { createConnector } from '@repo/connector-sdk';

/**
 * Screening connector (sanctions, PEP, adverse media; CMP-01): one synchronous check per person, a
 * `screening_result` record on the case with the potential matches for compliance to adjudicate.
 */
const DEFAULT_BASE_URL = process.env.SCREENING_API_URL ?? 'http://localhost:9407';

interface Settings { baseUrl: string }

async function search(settings: Settings, apiKey: string | null, body: Record<string, unknown>) {
  const response = await fetch(new URL('/v1/searches', settings.baseUrl), {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Token ${apiKey ?? ''}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Screening API answered ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return response.json() as Promise<{ id: string; result: 'clear' | 'potential_match'; matches: Array<{ list: string; name: string; score: number }>; lists: string[] }>;
}

const connector = createConnector({
  manifest: {
    id: 'screening', version: '1.0.0', name: 'AML screening', description: 'Screen people against sanctions, PEP and adverse media lists.',
    publisher: { name: 'Fintivio' }, categories: ['compliance'], icon: 'ShieldAlert', audiences: ['tenant'], scopes: ['installation:write', 'records:write'],
    components: [{
      key: 'screening.check', version: 1, kind: 'action', title: 'Screen a person (AML)', description: 'Sanctions, PEP and adverse media screening; potential matches go to compliance.',
      icon: 'ShieldAlert', category: 'data',
      configSchema: { type: 'object', properties: { lists: { type: 'array', title: 'Lists', items: { type: 'string', enum: ['sanctions', 'pep', 'adverse_media'] } } } },
      inputSchema: { type: 'object', required: ['name'], properties: { name: { type: 'string', title: 'Full name' }, birthYear: { type: 'string', title: 'Year of birth' }, country: { type: 'string', title: 'Country' } } },
      defaults: { lists: ['sanctions', 'pep', 'adverse_media'], input: { name: '{{case.applicant.name}}' } },
      summary: 'Screening via {{connection}}', events: ['clear', 'potential_match'], invoke: { url: '', mode: 'sync' }, dataClasses: ['identity'],
    }],
    triggers: [], egress: ['the screening vendor'],
  },
  settings: {
    intro: 'Use an API key of your screening vendor account.',
    fields: [
      { name: 'apiKey', label: 'API key', secret: true, required: true },
      { name: 'baseUrl', label: 'API base URL', type: 'url', required: true, default: DEFAULT_BASE_URL },
    ],
    async test(values, secrets) {
      const response = await fetch(new URL('/v1/account', values.baseUrl), { headers: { Authorization: `Token ${secrets.apiKey}` }, signal: AbortSignal.timeout(10_000) }).catch((e) => { throw new Error(`Could not reach ${values.baseUrl}: ${e.message}`); });
      if (!response.ok) throw new Error('The screening vendor refused the API key');
    },
    summary: (values) => ({ api: new URL(values.baseUrl).host }),
    displayName: () => 'AML screening',
  },
});

connector.action('screening.check', async ({ installation, config, input, callback }) => {
  const name = String(input.name ?? '').trim();
  if (!name) return { outcome: 'potential_match', output: { error: 'No name to screen: compliance must check manually' } };
  const result = await search(installation.config as unknown as Settings, await installation.secrets.get('apiKey'), { name, birth_year: input.birthYear || undefined, country: input.country || undefined, lists: config.lists });
  const record = await installation.core.records.upsert({
    type: 'screening_result', externalRef: result.id, status: result.result, callbackToken: callback.token,
    summary: result.result === 'clear' ? `No matches for ${name}` : `${result.matches.length} potential match(es) for ${name}`,
    data: { subject: name, lists: result.lists, matches: result.matches },
  });
  return { outcome: result.result, output: { result: result.result, matches: result.matches.length, recordId: record.id } };
});

await connector.listen();
