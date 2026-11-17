import { createConnector, type Installation } from '@repo/connector-sdk';
import { pdfText } from './pdf-text';

/**
 * AI connector (docs/plans/12): steps backed by a language model with an OpenAI-compatible API (OpenAI, Azure OpenAI,
 * Mistral, a self-hosted vLLM/Ollama, or a gateway in front of other providers). The institution brings its own key
 * and model; documents are read through the core (only files of the step's case, audited) and sent to the model as
 * text (and, if enabled, as the file itself for scanned documents).
 *
 *  - `document.extract`: fields described in the step (name, description, type) → values, with the fields the model
 *    could not find; the result is also attached to the case as a `document` record;
 *  - `text.generate`: instructions + text → an answer (summaries for reviewers, letters, classifications).
 *
 * Models make mistakes: extraction results are for people to check (the reviewer sees values and missing fields),
 * workflows compare them with what was declared, and nothing here decides on its own.
 */
interface Settings { baseUrl: string; model: string; sendFiles?: boolean }

const DEFAULT_BASE_URL = process.env.AI_API_URL ?? (process.env.NODE_ENV === 'production' ? 'https://api.openai.com/v1' : 'http://localhost:9409/v1');
const MAX_TEXT = 60_000;

async function complete(installation: Installation, body: Record<string, unknown>) {
  const settings = installation.config as unknown as Settings;
  const response = await fetch(`${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST', signal: AbortSignal.timeout(90_000),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await installation.secrets.get('apiKey')) ?? ''}` },
    body: JSON.stringify({ model: settings.model, temperature: 0, ...body }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`The model API answered ${response.status}: ${text.slice(0, 300)}`);
  const parsed = JSON.parse(text) as { choices: Array<{ message: { content: string } }>; usage?: { total_tokens?: number }; model?: string };
  return { content: parsed.choices?.[0]?.message?.content ?? '', tokens: parsed.usage?.total_tokens ?? null, model: parsed.model ?? settings.model };
}

/** A document of the step's case as model input: its text, and the file itself when enabled. */
async function documentInput(installation: Installation, fileId: string, callbackToken: string) {
  const file = await installation.core.documents.read(fileId, callbackToken);
  const text = file.contentType === 'application/pdf' ? pdfText(file.content) : file.contentType.startsWith('text/') ? file.content.toString('utf8') : '';
  const settings = installation.config as unknown as Settings;
  const parts: Array<Record<string, unknown>> = [{ type: 'text', text: `Document "${file.name}":\n${text.slice(0, MAX_TEXT) || '(no text layer)'}` }];
  if (settings.sendFiles && (file.contentType === 'application/pdf' || file.contentType.startsWith('image/'))) {
    parts.push(file.contentType === 'application/pdf'
      ? { type: 'file', file: { filename: file.name, file_data: `data:application/pdf;base64,${file.content.toString('base64')}` } }
      : { type: 'image_url', image_url: { url: `data:${file.contentType};base64,${file.content.toString('base64')}` } });
  }
  return { file, text, parts };
}

const FIELD_TYPES = ['string', 'number', 'date', 'boolean'] as const;
const fileIdOf = (value: unknown): string | null => {
  if (typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)) return value;
  if (Array.isArray(value)) return fileIdOf(value[0]);
  if (value && typeof value === 'object') return fileIdOf((value as { fileId?: unknown; id?: unknown }).fileId ?? (value as { id?: unknown }).id);
  return null;
};

const connector = createConnector({
  manifest: {
    id: 'ai', version: '1.0.0', name: 'AI assistant', description: 'Extract data from documents and write texts with a language model (OpenAI-compatible API).',
    publisher: { name: 'Fintivio' }, categories: ['ai'], icon: 'Sparkles', audiences: ['tenant'], scopes: ['installation:write', 'records:write', 'files:read'],
    components: [
      {
        key: 'document.extract', version: 1, kind: 'action', title: 'Extract data from a document (AI)',
        description: 'Reads a document of the case (pay stub, buyer\'s order, bank statement…) and returns the fields you describe; people check the result.',
        icon: 'ScanText', category: 'data',
        configSchema: {
          type: 'object', required: ['fields'],
          properties: {
            documentType: { type: 'string', title: 'What the document is', description: 'e.g. pay stub' },
            instructions: { type: 'string', title: 'Extra instructions', 'x-widget': 'textarea' },
            fields: {
              type: 'array', title: 'Fields to extract', minItems: 1,
              items: { type: 'object', properties: { name: { type: 'string', title: 'Name', description: 'e.g. grossMonthlyIncome' }, description: { type: 'string', title: 'Description' }, type: { type: 'string', title: 'Type', enum: [...FIELD_TYPES] } } },
            },
          },
        },
        inputSchema: { type: 'object', required: ['file'], properties: { file: { type: 'string', title: 'Document', description: 'a file of the case, e.g. = input.payStub' } } },
        defaults: { documentType: 'pay stub', fields: [{ name: 'employer', description: 'employer name', type: 'string' }, { name: 'grossMonthlyIncome', description: 'gross monthly income', type: 'number' }], input: { file: '= input.payStub' } },
        summary: 'Extracts {{documentType}} via {{connection}}', events: ['extracted', 'incomplete', 'failed'], invoke: { url: '', mode: 'sync' }, dataClasses: ['financial', 'identity'],
      },
      {
        key: 'text.generate', version: 1, kind: 'action', title: 'Write with AI', description: 'Instructions and text in, an answer out: summaries for reviewers, letters, short assessments.',
        icon: 'Sparkles', category: 'data',
        configSchema: { type: 'object', required: ['instructions'], properties: { instructions: { type: 'string', title: 'Instructions', 'x-widget': 'textarea' }, maxWords: { type: 'integer', title: 'At most (words)' } } },
        inputSchema: { type: 'object', required: ['text'], properties: { text: { type: 'string', title: 'Text', description: 'what the model works on, e.g. a summary of the case' }, file: { type: 'string', title: 'Document (optional)' } } },
        defaults: { instructions: 'Summarise this application for a credit analyst in three sentences.', maxWords: 80, input: { text: '' } },
        summary: 'AI text via {{connection}}', events: ['done', 'failed'], invoke: { url: '', mode: 'sync' }, dataClasses: [],
      },
    ],
    triggers: [], egress: ['the model API configured in each connection (OpenAI-compatible)'],
    dataHandling: { stores: ['API key (encrypted)'], retention: 'documents and answers are not stored by the connector; results are on the case', regions: ['depends on the model provider'] },
  },
  settings: {
    intro: 'Any OpenAI-compatible API: OpenAI, Azure OpenAI, Mistral, a gateway, or a model you host. Documents go to this provider.',
    fields: [
      { name: 'baseUrl', label: 'API base address', type: 'url', required: true, default: DEFAULT_BASE_URL, help: 'e.g. https://api.openai.com/v1' },
      { name: 'apiKey', label: 'API key', secret: true, required: true },
      { name: 'model', label: 'Model', required: true, default: process.env.AI_MODEL ?? 'gpt-4o-mini' },
      { name: 'sendFiles', label: 'Send the document itself too (for scanned documents; the model must accept files)', type: 'checkbox' },
    ],
    async test(values, secrets) {
      const response = await fetch(`${String(values.baseUrl).replace(/\/+$/, '')}/models`, { headers: { Authorization: `Bearer ${secrets.apiKey}` }, signal: AbortSignal.timeout(15_000) })
        .catch((e) => { throw new Error(`Could not reach ${values.baseUrl}: ${e.message}`); });
      if (response.status === 401 || response.status === 403) throw new Error('The provider refused the API key');
      if (!response.ok) throw new Error(`The provider answered ${response.status}`);
    },
    summary: (values) => ({ api: new URL(values.baseUrl).host, model: values.model }),
    displayName: (values) => `AI · ${values.model}`,
  },
});

connector.action('document.extract', async ({ installation, config, input, callback, log }) => {
  const fileId = fileIdOf(input.file);
  if (!fileId) return { outcome: 'failed', output: { error: 'No document given (input file)' } };
  const fields = (Array.isArray(config.fields) ? config.fields : []).filter((f: { name?: string }) => f?.name && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(f.name)) as Array<{ name: string; description?: string; type?: string }>;
  if (!fields.length) return { outcome: 'failed', output: { error: 'No fields to extract' } };
  try {
    const { file, text, parts } = await documentInput(installation, fileId, callback.token);
    const schema = {
      type: 'object', additionalProperties: false, required: fields.map((f) => f.name),
      properties: Object.fromEntries(fields.map((f) => [f.name, { type: [f.type === 'number' ? 'number' : f.type === 'boolean' ? 'boolean' : 'string', 'null'], description: `${f.description ?? f.name}${f.type === 'date' ? ' (YYYY-MM-DD)' : ''}` }])),
    };
    const result = await complete(installation, {
      messages: [
        { role: 'system', content: `You extract data from a ${config.documentType || 'document'} for a financial institution. Answer with the JSON object only. Use null when a value is not in the document; never guess. ${config.instructions ?? ''}`.trim() },
        { role: 'user', content: parts },
      ],
      response_format: { type: 'json_schema', json_schema: { name: 'extraction', strict: true, schema } },
    });
    let values: Record<string, unknown>;
    try {
      values = JSON.parse(result.content);
    } catch {
      return { outcome: 'failed', output: { error: 'The model did not answer with JSON' } };
    }
    const extracted = Object.fromEntries(fields.map((f) => [f.name, values[f.name] ?? null]));
    const missing = fields.filter((f) => extracted[f.name] === null || extracted[f.name] === '').map((f) => f.name);
    await installation.core.records.upsert({
      type: 'document', externalRef: `extract:${fileId}:${callback.token.slice(-12)}`, status: missing.length ? 'incomplete' : 'extracted', callbackToken: callback.token,
      summary: `${config.documentType || 'Document'} read by AI: ${fields.length - missing.length}/${fields.length} fields${missing.length ? ` (missing ${missing.join(', ')})` : ''}`,
      data: { provider: 'ai', model: result.model, file: { id: file.id, name: file.name }, fields: extracted, missing, textLength: text.length },
    });
    log.info('document extracted', { installation: installation.id, file: file.id, fields: fields.length, missing: missing.length, tokens: result.tokens });
    return { outcome: missing.length ? 'incomplete' : 'extracted', output: { ...extracted, fields: extracted, missing, model: result.model, document: file.name } };
  } catch (error) {
    log.error('extraction failed', { installation: installation.id, error: (error as Error).message });
    return { outcome: 'failed', output: { error: (error as Error).message } };
  }
});

connector.action('text.generate', async ({ installation, config, input, callback, log }) => {
  try {
    const parts: Array<Record<string, unknown>> = [{ type: 'text', text: String(input.text ?? '').slice(0, MAX_TEXT) }];
    const fileId = fileIdOf(input.file);
    if (fileId) parts.push(...(await documentInput(installation, fileId, callback.token)).parts);
    const result = await complete(installation, {
      messages: [
        { role: 'system', content: `${config.instructions}${config.maxWords ? ` Use at most ${config.maxWords} words.` : ''}` },
        { role: 'user', content: parts },
      ],
    });
    log.info('text generated', { installation: installation.id, tokens: result.tokens });
    return { outcome: 'done', output: { text: result.content.trim(), model: result.model } };
  } catch (error) {
    return { outcome: 'failed', output: { error: (error as Error).message } };
  }
});

await connector.listen();
