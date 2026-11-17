import type { ManifestInput } from '@repo/connector-sdk';

export const manifest: ManifestInput = {
  id: 'documenso',
  version: '1.0.0',
  name: 'Documenso e-signature',
  description: 'Have clients sign agreements from your Documenso templates; the signed PDF is attached to the case.',
  publisher: { name: 'Fintivio', url: 'https://fintivio.dev', support: 'support@lintelia.example' },
  categories: ['e_signature'],
  icon: 'Signature',
  audiences: ['tenant'],
  scopes: ['installation:write', 'records:write', 'files:write'],
  components: [
    {
      key: 'signature.request',
      version: 1,
      kind: 'client_step',
      title: 'Sign a document (Documenso)',
      description: 'The client signs a document generated from a Documenso template; the signed PDF is attached to the case.',
      icon: 'Signature',
      category: 'client',
      configSchema: {
        type: 'object',
        required: ['templateId'],
        properties: {
          templateId: { type: 'string', title: 'Template', 'x-options': 'templates' },
          documentKind: { type: 'string', title: 'Document kind on the case', default: 'signed_agreement' },
          title: { type: 'string', title: 'Title of the task', description: 'what the person sees, e.g. The buyer signs the contract' },
          instructions: { type: 'string', title: 'Instructions', 'x-widget': 'textarea' },
        },
      },
      inputSchema: {
        type: 'object',
        required: ['signerEmail'],
        properties: {
          signerEmail: { type: 'string', title: 'Signer e-mail', description: 'e.g. {{case.applicant.email}}' },
          signerName: { type: 'string', title: 'Signer name' },
        },
      },
      defaults: { documentKind: 'signed_agreement', input: { signerEmail: '{{case.applicant.email}}', signerName: '{{case.applicant.name}}' } },
      summary: 'Signature via {{connection}}',
      events: ['signed', 'declined', 'expired'],
      invoke: { url: '', mode: 'async', timeout: 'P30D' },
      dataClasses: ['contact_details', 'signature'],
    },
  ],
  triggers: [],
  egress: ['Documenso (app.documenso.com or a self-hosted instance)'],
  dataHandling: { stores: ['API key and webhook secret (encrypted)', 'document ids'], retention: 'deleted when the connection is removed', regions: [] },
};
