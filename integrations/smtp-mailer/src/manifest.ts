import type { ManifestInput } from '@repo/connector-sdk';

export const manifest: ManifestInput = {
  id: 'smtp-mailer',
  version: '1.0.0',
  name: 'SMTP mailer',
  description: "Send workflow e-mails from your institution's own mail server and addresses.",
  publisher: { name: 'Lintelia', url: 'https://lintelia.example', support: 'support@lintelia.example' },
  categories: ['communication'],
  icon: 'Mail',
  audiences: ['tenant'],
  scopes: ['installation:write', 'records:write'],
  components: [
    {
      key: 'email.send',
      version: 1,
      kind: 'action',
      title: 'Send e-mail (your server)',
      description: "Send an e-mail through the institution's SMTP server and keep a record on the case.",
      icon: 'Mail',
      category: 'communication',
      configSchema: {
        type: 'object',
        required: ['subject', 'body'],
        properties: {
          subject: { type: 'string', title: 'Subject', description: 'templates allowed, e.g. Your application {{case.reference}}' },
          body: { type: 'string', title: 'Message', 'x-widget': 'textarea', description: 'plain text; templates allowed' },
          replyTo: { type: 'string', title: 'Reply-to address (optional)' },
        },
      },
      inputSchema: {
        type: 'object',
        required: ['to'],
        properties: {
          to: { type: 'string', title: 'To', description: 'e.g. {{case.applicant.email}}' },
        },
      },
      defaults: { input: { to: '{{case.applicant.email}}' } },
      summary: 'E-mail "{{subject}}" via {{connection}}',
      events: ['sent', 'failed'],
      invoke: { url: '', mode: 'sync' },
      dataClasses: ['contact_details'],
    },
  ],
  triggers: [],
  egress: ["the institution's SMTP server"],
  dataHandling: { stores: ['SMTP settings', 'password (encrypted)'], retention: 'deleted when the connection is removed', regions: [] },
};
