/**
 * Demo Bank helpers for manual testing (docs/testing/manual-testing.md):
 *
 *   bun run demo:workflows                       publish example workflows that use Demo Bank's active connections
 *   bun run demo:case "<workflow name>" k=v …    start a case on a published workflow (as admin@demo-bank.test)
 *   bun run demo:token [email]                   print an access token (default admin@demo-bank.test) for curl
 *   bun run demo:files                           write sample upload files (clean, with JavaScript, infected, fake) and payment QR codes to .data/demo-files
 *
 * Workflows needing a connection that does not exist yet are skipped with a hint (connect it under Integrations
 * as integrations@demo-bank.test, then run the command again). Already published workflows are left alone.
 */
export {};

const API = process.env.API_URL ?? 'http://localhost:8000';
const TENANT = process.env.DEMO_TENANT ?? 'demo-bank';
const PASSWORD = process.env.SEED_PASSWORD || 'fintivio-dev-password';

async function api<T = any>(token: string | null, method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Tenant': TENANT, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : null) as T;
}

async function token(email: string) {
  const session = await api<{ token?: string; mfaRequired?: boolean; mfaEnrollmentRequired?: boolean }>(null, 'POST', '/auth/login', { email, password: PASSWORD });
  if (!session.token) throw new Error(`${email} needs a second factor: use an account of a seeded institution (they do not require one)`);
  return session.token;
}

type Connections = Record<string, string | undefined>;

/** Example workflows; `needs` lists the connectors whose connection id is substituted for ${CONNECTOR}. */
const WORKFLOWS: Array<{ name: string; needs: string[]; yaml: (c: Connections, ids: Record<string, string>) => string; start: string }> = [
  {
    name: 'Demo: welcome e-mail (your server)', needs: ['smtp-mailer'], start: 'fullName=Ada email=ada@customers.example',
    yaml: (c) => `schemaVersion: "1"
name: "Demo: welcome e-mail (your server)"
description: Sends a welcome e-mail through the bank's own SMTP server (smtp-mailer connector)
version: 1
triggers: []
inputs:
  - { id: fullName, name: fullName, type: string, required: true }
  - { id: email, name: email, type: string, required: true }
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [mail] }] }
  - id: mail
    name: Welcome mail
    type: "connector:smtp-mailer/email.send"
    config:
      connection: ${c['smtp-mailer']}
      subject: "Welcome {{input.fullName}}"
      body: "Hello {{input.fullName}}, your reference is {{case.reference}}."
      input: { to: "{{input.email}}" }
    events: [{ name: sent, outputs: [], next: [done] }, { name: failed, outputs: [], next: [done] }]
  - { id: done, name: Done, type: case.decision, config: { status: completed }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }
`,
  },
  {
    name: 'Demo: credit lookup', needs: ['postgres-datasource'], start: 'customerId=C-1001',
    yaml: (c) => `schemaVersion: "1"
name: "Demo: credit lookup"
description: Reads a credit score from the bank's own database (postgres-datasource connector)
version: 1
triggers: []
inputs:
  - { id: customerId, name: customerId, type: string, required: true }
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [lookup] }] }
  - id: lookup
    name: Credit score
    type: "connector:postgres-datasource/query.run"
    config:
      connection: ${c['postgres-datasource']}
      query: "select customer_id, score, bureau from credit_scores where customer_id = :customerId"
      params: { customerId: "{{input.customerId}}" }
    events: [{ name: success, outputs: [], next: [decide] }, { name: failed, outputs: [], next: [done] }]
  - id: decide
    name: Good score?
    type: conditional
    config: { expression: "steps.lookup.rowCount > 0 and steps.lookup.rows[0].score >= 600" }
    events: [{ name: "true", outputs: [], next: [approve] }, { name: "false", outputs: [], next: [review] }]
  - id: review
    name: Credit review
    type: review
    config: { title: "Low or missing score for {{input.customerId}}", assignTo: { role: reviewer }, sla: PT24H }
    events: [{ name: review_approved, outputs: [], next: [approve] }, { name: review_rejected, outputs: [], next: [done] }]
  - { id: approve, name: Approve, type: case.decision, config: { status: approved }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }
  - { id: done, name: Done, type: case.decision, config: { status: closed }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }
`,
  },
  {
    name: 'Demo: retail account opening', needs: ['didit', 'documenso'], start: 'fullName="Ada Lovelace" email=ada@customers.example',
    yaml: (c) => `schemaVersion: "1"
name: "Demo: retail account opening"
description: Identity verification (Didit), manual review when inconclusive, agreement signature (Documenso)
version: 1
triggers: []
caseTitle: "Account opening: {{input.fullName}}"
inputs:
  - { id: email, name: email, type: string, required: true }
  - { id: fullName, name: fullName, type: string, required: true }
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [kyc] }] }
  - id: kyc
    name: Verify identity
    type: "connector:didit/kyc.verify"
    config:
      connection: ${c.didit}
      input: { email: "{{case.applicant.email}}", fullName: "{{input.fullName}}" }
      remindAfter: PT10M
      expiresAfter: P7D
    events:
      - { name: approved, outputs: [], next: [sign] }
      - { name: declined, outputs: [], next: [reject] }
      - { name: in_review, outputs: [], next: [review] }
      - { name: expired, outputs: [], next: [reject] }
  - id: review
    name: KYC review
    type: review
    config: { title: Inconclusive identity verification, assignTo: { role: reviewer }, sla: PT24H, escalateTo: { role: senior_reviewer } }
    events: [{ name: review_approved, outputs: [], next: [sign] }, { name: review_rejected, outputs: [], next: [reject] }]
  - id: sign
    name: Sign account agreement
    type: "connector:documenso/signature.request"
    config:
      connection: ${c.documenso}
      templateId: retail-account-agreement
      documentKind: signed_agreement
      input: { signerEmail: "{{case.applicant.email}}", signerName: "{{input.fullName}}" }
    events: [{ name: signed, outputs: [], next: [approve] }, { name: declined, outputs: [], next: [reject] }, { name: expired, outputs: [], next: [reject] }]
  - { id: approve, name: Approve, type: case.decision, config: { status: approved, outcome: account_opened }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }
  - { id: reject, name: Reject, type: case.decision, config: { status: rejected }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }
`,
  },
  {
    name: 'Demo: party identity verification', needs: ['didit'], start: '(started by "Demo: business onboarding" for each party)',
    yaml: (c) => `schemaVersion: "1"
name: "Demo: party identity verification"
description: A related party joins through their invitation and verifies their identity (run per party)
version: 1
triggers: []
caseTitle: "Identity verification ({{input.role}})"
inputs:
  - { id: partyId, name: partyId, type: string, required: true }
  - { id: role, name: role, type: string, required: true }
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [joined] }] }
  - id: joined
    name: Party joins
    type: parties.wait
    config: { party: "{{input.partyId}}", timeout: P14D }
    events: [{ name: joined, outputs: [], next: [kyc] }, { name: expired, outputs: [], next: [declined] }]
  - id: kyc
    name: Verify identity
    type: "connector:didit/kyc.verify"
    config: { connection: ${c.didit}, input: { email: "{{case.applicant.email}}" } }
    events:
      - { name: approved, outputs: [], next: [verified] }
      - { name: in_review, outputs: [], next: [verified] }
      - { name: declined, outputs: [], next: [declined] }
      - { name: expired, outputs: [], next: [declined] }
  - id: verified
    name: Record verification
    type: parties.update
    config: { party: "{{input.partyId}}", status: completed, data: { verification: "{{steps.kyc.status}}" } }
    events: [{ name: done, outputs: [], next: [done] }]
  - id: declined
    name: Record failure
    type: parties.update
    config: { party: "{{input.partyId}}", status: declined, data: { verification: declined } }
    events: [{ name: done, outputs: [], next: [done] }]
  - { id: done, name: Done, type: case.decision, config: { status: completed }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }
`,
  },
  {
    name: 'Demo: business onboarding', needs: ['didit'], start: 'companyName="Widgets Ltd" email=owner@widgets.example',
    yaml: (_c, ids) => `schemaVersion: "1"
name: "Demo: business onboarding"
description: The applicant lists beneficial owners and directors; each verifies themselves before the review
version: 1
triggers: []
caseTitle: "Business onboarding: {{input.companyName}}"
inputs:
  - { id: email, name: email, type: string, required: true }
  - { id: companyName, name: companyName, type: string, required: true }
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [parties] }] }
  - id: parties
    name: Related parties
    type: parties.collect
    config: { title: Tell us who owns and runs the company, roles: [ubo, director], minimum: { ubo: 1 } }
    events: [{ name: collected, outputs: [], next: [verify] }, { name: expired, outputs: [], next: [reject] }]
  - id: verify
    name: Verify every party
    type: foreach
    config:
      items: "= steps.parties.parties"
      workflowId: ${ids['Demo: party identity verification']}
      inputs: { partyId: "= item.id", role: "= item.role" }
      applicant: "= item.personId"
      onItemFailure: continue
    events: [{ name: completed, outputs: [], next: [review] }, { name: failed, outputs: [], next: [review] }]
  - id: review
    name: KYB review
    type: review
    config: { title: "Business onboarding: {{input.companyName}}", assignTo: { role: reviewer }, sla: PT24H }
    events: [{ name: review_approved, outputs: [], next: [approve] }, { name: review_rejected, outputs: [], next: [reject] }]
  - { id: approve, name: Approve, type: case.decision, config: { status: approved }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }
  - { id: reject, name: Reject, type: case.decision, config: { status: rejected }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }
`,
  },
  {
    name: 'Demo: AML screening', needs: ['screening'], start: 'fullName="John Smith" email=john@customers.example',
    yaml: (c) => `schemaVersion: "1"
name: "Demo: AML screening"
description: Sanctions/PEP screening; potential matches go to compliance
version: 1
triggers: []
caseTitle: "Screening: {{input.fullName}}"
inputs:
  - { id: email, name: email, type: string, required: true }
  - { id: fullName, name: fullName, type: string, required: true }
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [screen] }] }
  - id: screen
    name: Screening
    type: "connector:screening/screening.check"
    config: { connection: ${c.screening}, lists: [sanctions, pep, adverse_media], input: { name: "{{input.fullName}}" } }
    events: [{ name: clear, outputs: [], next: [approve] }, { name: potential_match, outputs: [], next: [adjudicate] }]
  - id: adjudicate
    name: Adjudicate screening hit
    type: review
    config: { title: Potential screening match, kind: screening_hit, assignTo: { role: compliance_officer }, sla: PT4H }
    events: [{ name: review_approved, outputs: [], next: [approve] }, { name: review_rejected, outputs: [], next: [reject] }]
  - { id: approve, name: Approve, type: case.decision, config: { status: approved }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }
  - { id: reject, name: Reject, type: case.decision, config: { status: rejected, notifyApplicant: false, addFlags: [suspicious_activity_report] }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }
`,
  },
  {
    name: 'Demo: document request', needs: [], start: 'email=client@demo-bank.test',
    yaml: () => `schemaVersion: "1"
name: "Demo: document request"
description: Asks the client for a proof of address (uploads are scanned and sanitised), then a team member reviews it
version: 1
triggers: []
inputs:
  - { id: email, name: email, type: string, required: true }
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [ask] }] }
  - id: ask
    name: Ask for proof of address
    type: client.request
    config:
      title: Please send a proof of address
      items: [{ key: proofOfAddress, label: Proof of address (PDF or photo), type: file }]
      expiresAfter: P7D
    events: [{ name: completed, outputs: [], next: [review] }, { name: expired, outputs: [], next: [done] }]
  - id: review
    name: Check the document
    type: review
    config: { title: Check the proof of address, assignTo: { role: reviewer }, sla: PT24H }
    events: [{ name: review_approved, outputs: [], next: [done] }, { name: review_rejected, outputs: [], next: [done] }]
  - { id: done, name: Done, type: case.decision, config: { status: completed }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }
`,
  },
  {
    name: 'Demo: decision from the bank system', needs: [], start: 'started by POST /events (type loan.requested), see the testing guide',
    yaml: () => `schemaVersion: "1"
name: "Demo: decision from the bank system"
description: Started by the bank's own system through the API (event api:loan.requested); decides automatically
version: 1
triggers: []
startOn: ["api:loan.requested"]
inputs:
  - { id: amount, name: amount, type: number, required: true }
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [check] }] }
  - id: check
    name: Small amount?
    type: conditional
    config: { expression: "$number(input.amount) <= 1000" }
    events: [{ name: "true", outputs: [], next: [approve] }, { name: "false", outputs: [], next: [reject] }]
  - { id: approve, name: Approve, type: case.decision, config: { status: approved, outcome: auto_approved }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }
  - { id: reject, name: Reject, type: case.decision, config: { status: rejected, outcome: too_large }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }
`,
  },
  {
    name: 'Demo: party check call', needs: [], start: '(started by "Demo: joint application" for each co-applicant)',
    yaml: () => `schemaVersion: "1"
name: "Demo: party check call"
description: A team member calls a co-applicant; one person handles every co-applicant of an application
version: 1
triggers: []
caseTitle: "Call the {{input.role}}"
inputs:
  - { id: partyId, name: partyId, type: string, required: true }
  - { id: role, name: role, type: string, required: true }
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [call] }] }
  - id: call
    name: Call the party
    type: task
    config: { title: "Call the {{input.role}}", description: Confirm identity and intent by phone., assignTo: { role: reviewer }, sameAssigneeAs: siblings }
    events: [{ name: done, outputs: [], next: [end] }]
  - { id: end, name: Done, type: case.decision, config: { status: completed }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }
`,
  },
  {
    name: 'Demo: joint application', needs: [], start: 'email=client@demo-bank.test',
    yaml: (_c, ids) => `schemaVersion: "1"
name: "Demo: joint application"
description: The applicant adds two co-applicants; a team member checks each of them
version: 1
triggers: []
inputs:
  - { id: email, name: email, type: string, required: true }
steps:
  - { id: start, name: Start, type: start, events: [{ name: finished, outputs: [], next: [parties] }] }
  - id: parties
    name: Co-applicants
    type: parties.collect
    config: { title: Who applies with you?, roles: [co_applicant], minimum: { co_applicant: 2 } }
    events: [{ name: collected, outputs: [], next: [checks] }, { name: expired, outputs: [], next: [end] }]
  - id: checks
    name: Check every co-applicant
    type: foreach
    config: { items: "= steps.parties.parties", workflowId: ${ids['Demo: party check call']}, inputs: { partyId: "= item.id", role: "= item.role" } }
    events: [{ name: completed, outputs: [], next: [end] }, { name: failed, outputs: [], next: [end] }]
  - { id: end, name: Done, type: case.decision, config: { status: completed }, isTerminal: true, events: [{ name: done, outputs: [], next: [] }] }
`,
  },
];

async function publishWorkflows() {
  const designer = await token('designer@demo-bank.test');
  const connections = await api<Array<{ id: string; connectorId: string; status: string }>>(designer, 'GET', '/integrations');
  const byConnector: Connections = {};
  for (const c of connections) if (c.status === 'active') byConnector[c.connectorId] ??= c.id;
  const existing = await api<Array<{ id: string; name: string; status: string }>>(designer, 'GET', '/workflows');
  const ids: Record<string, string> = Object.fromEntries(existing.map((w) => [w.name, w.id]));
  const published = new Set(existing.filter((w) => w.status === 'active').map((w) => w.name));
  const hint = (workflow: (typeof WORKFLOWS)[number]) => (workflow.start.includes('=') && !workflow.start.startsWith('(') && !workflow.start.startsWith('started')
    ? `start: bun run demo:case "${workflow.name}" ${workflow.start}` : workflow.start);
  for (const workflow of WORKFLOWS) {
    const missing = workflow.needs.filter((n) => !byConnector[n]);
    if (published.has(workflow.name)) { console.log(`= ${workflow.name} (already published) · ${hint(workflow)}`); continue; }
    if (missing.length) { console.log(`- ${workflow.name}: skipped, connect ${missing.join(' and ')} first (Integrations, as integrations@demo-bank.test)`); continue; }
    const yaml = workflow.yaml(byConnector, ids);
    // A draft left by an earlier attempt is updated, otherwise created.
    const id = ids[workflow.name] ?? (await api<{ id: string }>(designer, 'POST', '/workflows', { yaml })).id;
    if (ids[workflow.name]) await api(designer, 'PUT', `/workflows/${id}`, { yaml });
    await api(designer, 'POST', `/workflows/${id}/publish`);
    ids[workflow.name] = id;
    console.log(`+ ${workflow.name} published · ${hint(workflow)}`);
  }
}

async function startCase(name: string, pairs: string[]) {
  const admin = await token('admin@demo-bank.test');
  const workflows = await api<Array<{ id: string; name: string }>>(admin, 'GET', '/workflows');
  const workflow = workflows.find((w) => w.name === name);
  if (!workflow) throw new Error(`No workflow named "${name}". Published: ${workflows.map((w) => w.name).join(', ')}`);
  const inputs = Object.fromEntries(pairs.map((p) => {
    const [key, ...rest] = p.split('=');
    const value = rest.join('=');
    return [key, /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value];
  }));
  const started = await api<{ caseId: string; reference: string }>(admin, 'POST', `/workflows/${workflow.id}/executions`, { inputs });
  console.log(`case ${started.reference} started (${started.caseId})`);
  console.log(`back office: http://${TENANT}.localhost:3001/app/cases/${started.caseId}`);
  if (typeof inputs.email === 'string') console.log(`client portal: http://${TENANT}.localhost:3001/portal (sign in as ${inputs.email} with "Email me a code"; codes at http://localhost:8025)`);
}

/** Sample files for the upload journeys: what the intake pipeline accepts, cleans, or refuses. */
async function writeFiles() {
  const { PDFDocument, StandardFonts } = await import('pdf-lib');
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const dir = resolve(import.meta.dir, '../../../.data/demo-files');
  mkdirSync(dir, { recursive: true });
  const pdf = async (text: string, javascript = false) => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]).drawText(text, { x: 50, y: 780, size: 14, font: await doc.embedFont(StandardFonts.Helvetica) });
    if (javascript) doc.addJavaScript('hello', 'app.alert("this script is removed by the sanitiser");');
    return Buffer.from(await doc.save({ useObjectStreams: false }));
  };
  // Stipulations of a deal (dealer finance, Demo Auto Finance): digital documents the AI connector reads line by line.
  const document = async (lines: string[]) => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    lines.forEach((line, i) => page.drawText(line, { x: 50, y: 780 - i * 22, size: i === 0 ? 16 : 12, font }));
    return Buffer.from(await doc.save({ useObjectStreams: false }));
  };
  const eicar = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
  const files: Record<string, Buffer> = {
    'utility-bill.pdf': await pdf('Utility bill - 1 High Street - March'),
    'statement-with-javascript.pdf': await pdf('Bank statement (contains a script)', true),
    'infected-invoice.pdf': Buffer.concat([await pdf('Invoice'), Buffer.from(`\n%${eicar}\n`)]),
    'program-renamed.pdf': Buffer.concat([Buffer.from('MZ'), Buffer.alloc(62), Buffer.from('PE\0\0'), Buffer.alloc(200)]),
    'deal-pay-stub.pdf': await document(['Pay stub - October 2026', 'Employer: Northwind Logistics', 'Employee name: Jamie Rivera', 'Pay date: 2026-10-31', 'Gross monthly income: $5,400.00']),
    'deal-buyers-order.pdf': await document(["Buyer's order - Sunrise Motors", 'Buyer name: Jamie Rivera', 'Vehicle: 2022 Honda Accord', 'VIN: 1HGCV1F30LA012345', 'Sale price: $24,500.00', 'Down payment: $3,500.00', 'Amount financed: $21,000.00']),
    'deal-drivers-license.pdf': await document(['Driver license - State of Texas', 'Name: Jamie Rivera', 'License number: 40917733', 'Expires: 2030-05-01']),
  };
  // Payment QR codes (docs/plans/14) for the banking app's "Pay with a QR code": use them with "Use a photo", show
  // them on screen to a phone's camera, or paste the text with "Type the code instead".
  const { buildEmvPayload } = await import('@repo/fintivio/utilities');
  const { default: qrcode } = await import('qrcode-generator');
  const codes: Record<string, string> = {
    'pay-corner-cafe': buildEmvPayload({ gui: 'uk.fintivio.demo', account: 'SHOP-42', name: 'Corner Cafe', city: 'London', country: 'GB', currency: 'GBP', amount: 12.5, reference: 'T-881', mcc: '5812' }),
    'pay-market-stall': buildEmvPayload({ gui: 'uk.fintivio.demo', account: 'STALL-7', name: 'Market Stall', city: 'Bristol', country: 'GB', currency: 'GBP' }),
    'pay-nyc-deli-usd': buildEmvPayload({ gui: 'us.fintivio.demo', account: 'DELI-1', name: 'NYC Deli', city: 'New York', country: 'US', currency: 'USD', amount: 8 }),
  };
  for (const [name, payload] of Object.entries(codes)) {
    const qr = qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
    files[`${name}.gif`] = Buffer.from(qr.createDataURL(8, 4).split(',')[1], 'base64');
  }
  files['payment-codes.txt'] = Buffer.from(`${Object.entries(codes).map(([name, payload]) => `${name}\n${payload}\n`).join('\n')}`);
  for (const [name, bytes] of Object.entries(files)) writeFileSync(resolve(dir, name), bytes);
  console.log(`sample files in ${dir}:`);
  console.log('  utility-bill.pdf               accepted');
  console.log('  statement-with-javascript.pdf  accepted, the script is removed (reviewers see "removed JavaScript")');
  console.log('  infected-invoice.pdf           refused: malware detected (EICAR test signature)');
  console.log('  program-renamed.pdf            refused: not an accepted type (an executable renamed to .pdf)');
  console.log('  deal-*.pdf                     a deal\'s stipulations (pay stub, buyer\'s order, licence) for Demo Auto Finance:');
  console.log('                                 VIN 1HGCV1F30LA012345, sale 24,500, financed 21,000, income 5,400/month');
  console.log('  pay-*.gif, payment-codes.txt   payment QR codes for Demo Bank\'s "Pay with a QR code" (a photo, or the text typed):');
  console.log('                                 Corner Cafe £12.50 (continues by itself), Market Stall (any amount), NYC Deli in USD (refused)');
}

const [command, ...args] = process.argv.slice(2);
try {
  if (command === 'workflows') await publishWorkflows();
  else if (command === 'case') await startCase(args[0] ?? '', args.slice(1));
  else if (command === 'token') console.log(await token(args[0] ?? 'admin@demo-bank.test'));
  else if (command === 'files') await writeFiles();
  else {
    console.error('usage: bun scripts/demo.ts workflows | case "<workflow name>" key=value … | token [email] | files');
    process.exit(1);
  }
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
