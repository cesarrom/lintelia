import type { ManifestInput } from '@repo/connector-sdk';

export const manifest: ManifestInput = {
  id: 'didit',
  version: '1.0.0',
  name: 'Didit identity verification',
  description: 'Verify identities with an ID document and a selfie (liveness and face match), optionally AML screening.',
  publisher: { name: 'Fintivio', url: 'https://fintivio.dev', support: 'support@lintelia.example' },
  categories: ['identity_verification'],
  icon: 'ScanFace',
  audiences: ['tenant'],
  scopes: ['installation:write', 'records:write', 'events:publish'],
  components: [
    {
      key: 'kyc.verify',
      version: 1,
      kind: 'client_step',
      title: 'Verify identity (Didit)',
      description: 'The client verifies their identity in the portal (ID document + selfie). Continues with the decision.',
      icon: 'ScanFace',
      category: 'client',
      configSchema: {
        type: 'object',
        properties: {
          workflowId: { type: 'string', title: 'Didit workflow', description: 'leave empty to use the connection default', 'x-options': 'workflows' },
        },
      },
      inputSchema: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', title: 'Applicant e-mail', description: 'e.g. {{case.applicant.email}}' },
          fullName: { type: 'string', title: 'Full name (optional prefill)' },
        },
      },
      defaults: { input: { email: '{{case.applicant.email}}', fullName: '{{case.applicant.name}}' } },
      summary: 'Identity verification via {{connection}}',
      events: ['approved', 'declined', 'in_review', 'expired'],
      invoke: { url: '', mode: 'async', timeout: 'P7D' },
      dataClasses: ['identity_document', 'biometric'],
    },
  ],
  triggers: [{ key: 'verification.updated', title: 'A verification changed after its step ended', description: 'e.g. a manual review at Didit approved it later' }],
  egress: ['Didit (verification.didit.me)'],
  dataHandling: { stores: ['API key and webhook secret (encrypted)', 'session ids', 'decision summaries'], retention: 'deleted when the connection is removed', regions: ['EU'] },
};
