/**
 * Development seed data. Idempotent: existing tenants/users are left alone.
 *
 * It connects with the same restricted roles as the API (fintivio_platform / fintivio_app), so seeding also checks
 * that grants and row level security policies allow the normal provisioning path.
 *
 * Accounts (password = SEED_PASSWORD, default below; development only):
 *   staff@fintivio.local           platform staff, platform_admin (no tenant; sign in on the root app); second factor:
 *                                  TOTP with the development secret below (`bun run totp` prints the current code)
 *   Demo Bank (tenant key demo-bank), one member per system role:
 *     admin@demo-bank.test         admin
 *     compliance@demo-bank.test    compliance_officer (MLRO)
 *     lead@demo-bank.test          senior_reviewer
 *     analyst@demo-bank.test       reviewer
 *     rm@demo-bank.test            relationship_manager
 *     designer@demo-bank.test      flow_designer
 *     integrations@demo-bank.test  integration_manager
 *     support@demo-bank.test       support_agent
 *     auditor@demo-bank.test       auditor
 *     client@demo-bank.test        a client (end user)
 *     senior@demo-bank.test        senior_reviewer (second approvals)
 *   admin@acme-credit.test         Acme Credit Union administrator (tenant key: acme-credit)
 *   Demo Auto Finance (tenant key demo-auto, dealer finance — docs/plans/12):
 *     admin@demo-auto.test, designer@demo-auto.test, underwriter@demo-auto.test (reviewer), funding@demo-auto.test
 *     (senior_reviewer), integrations@demo-auto.test; dealer@sunrise-motors.test: a dealer (client, segment dealer)
 *
 * Demo Bank content: the loan pre-approval and suspicious-activity workflows (published) and the loan application
 * form, published for the demo website (`bun run demo:site`, http://localhost:4000).
 */
import { eq, sql } from 'drizzle-orm';
import { createDatabases } from '../src/clients/database.client';
import { apiClientIndex, apiClients, clientProfiles, platformMfaFactors, platformUsers, publicFormKeys, roles, sysForms, sysWorkflows, tenantSecurityPolicies, tenants, userRoles, users, workflowVersions } from '../src/entities';
import { encryptSecret } from '../src/auth/data-encryption';

/** TOTP secret of the seeded staff account (development only; base32). */
export const DEV_STAFF_TOTP_SECRET = process.env.SEED_STAFF_TOTP_SECRET || 'FINTIVIODEVSTAFFSECRETAAAAAAAAAA';
import { templateYaml } from '../src/engine/templates';
import { installClientAppTemplate } from '../src/client-apps/templates';
import { seedBankingCustomer } from '../src/client-apps/templates/banking-demo-data';
import { ensureProfile } from '../src/client-apps/profiles';
import { loadApp } from '../src/client-apps/runtime-data';
import { parseDefinition } from '../src/engine/definition';
import type { Databases } from '../src/clients/database.client';
import { hashPassword } from '../src/auth/passwords';
import { hashSecret } from '../src/api-clients/api-clients';
import { randomUUID } from 'node:crypto';
import { provisionTenant, syncSystemRoles } from '../src/tenancy/provisioning';

export const DEFAULT_SEED_PASSWORD = 'fintivio-dev-password';

/** Public key of the demo loan form (hosted at http://demo-bank.localhost:3001/embed/forms/pf_demo_loan_form). */
export const DEMO_LOAN_FORM_KEY = 'pf_demo_loan_form';
/** Origin of the demo bank website (`bun run demo:site`), allowed to embed the loan form. */
export const DEMO_SITE_ORIGIN = 'http://localhost:4000';

/**
 * API client of the demo website's backend (`bun run demo:site`): opens client sessions for the embedded banking app.
 * Development credentials only.
 */
export const DEMO_SITE_API_CLIENT_ID = 'fc_demo_site';
export const DEMO_SITE_API_CLIENT_SECRET = process.env.DEMO_SITE_API_CLIENT_SECRET ?? 'fcs_demo_site_development_secret';

/** Published workflows from the templates, and the loan application form published for the demo website. */
async function seedDemoContent(databases: Databases, tenantId: string) {
  const db = databases.forTenant(tenantId);
  const workflowIds: Record<string, string> = {};
  for (const template of ['loan-pre-approval', 'suspicious-activity']) {
    const yaml = templateYaml(template)!;
    const definition = parseDefinition(yaml);
    const [existing] = await db.select({ id: sysWorkflows.id }).from(sysWorkflows).where(eq(sysWorkflows.name, definition.name));
    if (existing) {
      workflowIds[template] = existing.id;
      continue;
    }
    const [workflow] = await db.insert(sysWorkflows).values({
      name: definition.name, description: definition.description.slice(0, 255), yaml, status: 'active', version: 1, createdBy: 'seed',
    }).returning();
    await db.insert(workflowVersions).values({ workflowId: workflow.id, version: 1, yaml, startOn: definition.startOn, publishedBy: 'seed' });
    workflowIds[template] = workflow.id;
    console.log(`seeded workflow "${definition.name}" (published v1)`);
  }

  const [form] = await db.select({ id: sysForms.id }).from(sysForms).where(eq(sysForms.publicKey, DEMO_LOAN_FORM_KEY));
  if (!form) {
    const field = (propertyName: string, type: string, label: string, required = true) =>
      ({ id: propertyName, type, config: { type, propertyName, label, required, placeholder: '', description: '', validation: {} } });
    const [created] = await db.insert(sysForms).values({
      name: 'Personal loan pre-approval',
      description: 'Find out in minutes how much you can borrow.',
      createdBy: 'seed',
      config: {
        id: 'personal-loan', name: 'Personal loan pre-approval', variables: {},
        components: [
          field('fullName', 'text', 'Full name'), field('email', 'email', 'E-mail'),
          field('amount', 'number', 'Loan amount'), field('annualIncome', 'number', 'Annual income'),
          field('termMonths', 'number', 'Term (months)', false),
        ],
      } as any,
      publicKey: DEMO_LOAN_FORM_KEY, publishedAt: new Date(), allowedOrigins: [DEMO_SITE_ORIGIN], workflowId: workflowIds['loan-pre-approval'],
    }).returning();
    await databases.platform.insert(publicFormKeys).values({ key: DEMO_LOAN_FORM_KEY, tenantId, formId: created.id }).onConflictDoNothing();
    console.log(`seeded published form "Personal loan pre-approval" (${DEMO_LOAN_FORM_KEY}, embeddable on ${DEMO_SITE_ORIGIN})`);
  }

  // The client app (docs/plans/11): the banking app template with its journey workflows, published; Chris Client is an
  // existing customer with accounts, cards and two months of transactions.
  // Kept up to date with the template (workflows and app the seed created and nobody changed since).
  const app = await loadApp(db);
  if (!app || app.updatedBy === 'seed') {
    const installed = await installClientAppTemplate(db, { template: 'banking', by: 'seed', publish: true, institution: 'Demo Bank', refresh: true });
    if (installed.version) console.log(`seeded the client app "Banking app" (published v${installed.version}, ${Object.keys(installed.workflows).length} journey workflows)`);
  }
  const [siteClient] = await db.select({ id: apiClients.id }).from(apiClients).where(eq(apiClients.clientId, DEMO_SITE_API_CLIENT_ID));
  if (!siteClient) {
    await db.insert(apiClients).values({
      name: 'Demo website (embedded banking app)', clientId: DEMO_SITE_API_CLIENT_ID, permissions: ['clients:provision', 'clients:records'], createdByEmail: 'seed',
      secrets: [{ id: randomUUID(), hash: hashSecret(DEMO_SITE_API_CLIENT_SECRET), prefix: DEMO_SITE_API_CLIENT_SECRET.slice(0, 8), createdAt: new Date().toISOString(), expiresAt: null }],
    });
    await databases.platform.insert(apiClientIndex).values({ clientId: DEMO_SITE_API_CLIENT_ID, tenantId }).onConflictDoNothing();
    console.log(`seeded API client ${DEMO_SITE_API_CLIENT_ID} (demo website: client sessions for the embedded app)`);
  }
  const [chris] = await db.select({ id: users.id, name: users.name }).from(users).where(sql`lower(${users.email}) = 'client@demo-bank.test'`);
  if (chris && await seedBankingCustomer(db, chris.id, { name: chris.name, externalId: 'C-1001' })) console.log('seeded banking data of client@demo-bank.test (accounts, cards, transactions)');
  // Chris accepted the app's terms when he became a customer (new clients accept them in the app).
  if (chris) {
    const profile = await ensureProfile(db, chris.id);
    if (!profile.consents.length) {
      const acceptedAt = new Date().toISOString();
      await db.update(clientProfiles).set({ consents: [{ key: 'terms', version: '2026-01', acceptedAt }, { key: 'privacy', version: '2026-01', acceptedAt }] }).where(eq(clientProfiles.id, profile.id));
    }
  }
}

/** Sunrise Motors' user is an approved dealer (segment `dealer`) who accepted the portal's terms. */
async function seedDealer(databases: Databases, tenantId: string) {
  const db = databases.forTenant(tenantId);
  const [dealer] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = 'dealer@sunrise-motors.test'`);
  if (!dealer) return;
  const profile = await ensureProfile(db, dealer.id);
  if (profile.segments.includes('dealer')) return;
  const acceptedAt = new Date().toISOString();
  await db.update(clientProfiles).set({
    segments: ['dealer'], attributes: { ...profile.attributes, dealerName: 'Sunrise Motors', dealerLicense: 'P-100231', dealerState: 'TX', phone: '+1 512 555 0100' },
    consents: [{ key: 'terms', version: '2026-01', acceptedAt }, { key: 'privacy', version: '2026-01', acceptedAt }],
  }).where(eq(clientProfiles.id, profile.id));
  console.log('seeded dealer@sunrise-motors.test as a dealer of Demo Auto Finance (Sunrise Motors)');
}

type SeedUser = { email: string; name: string; kind: 'member' | 'client'; roles: string[] };

const TENANTS: Array<{ domain: string; name: string; allowedDomains: string[]; pallette: { primary: string; secondary: string; accent: string }; extraRoles: Array<{ key: string; name: string; permissions: string[] }>; users: SeedUser[] }> = [
  {
    domain: 'demo-bank',
    name: 'Demo Bank',
    allowedDomains: ['demo-bank.localhost:3001'],
    pallette: { primary: '#0b3d91', secondary: '#e8eef9', accent: '#f59e0b' },
    extraRoles: [],
    users: [
      { email: 'admin@demo-bank.test', name: 'Dana Admin', kind: 'member', roles: ['admin'] },
      { email: 'compliance@demo-bank.test', name: 'Morgan MLRO', kind: 'member', roles: ['compliance_officer'] },
      { email: 'lead@demo-bank.test', name: 'Lee Lead', kind: 'member', roles: ['senior_reviewer'] },
      { email: 'senior@demo-bank.test', name: 'Jordan Senior', kind: 'member', roles: ['senior_reviewer'] },
      { email: 'analyst@demo-bank.test', name: 'Alex Analyst', kind: 'member', roles: ['reviewer'] },
      { email: 'rm@demo-bank.test', name: 'Riley Relationship', kind: 'member', roles: ['relationship_manager'] },
      { email: 'designer@demo-bank.test', name: 'Devon Designer', kind: 'member', roles: ['flow_designer'] },
      { email: 'integrations@demo-bank.test', name: 'Ira Integrations', kind: 'member', roles: ['integration_manager'] },
      { email: 'support@demo-bank.test', name: 'Sam Support', kind: 'member', roles: ['support_agent'] },
      { email: 'auditor@demo-bank.test', name: 'Aud Itor', kind: 'member', roles: ['auditor'] },
      { email: 'client@demo-bank.test', name: 'Chris Client', kind: 'client', roles: [] },
    ],
  },
  {
    // Dealer finance (docs/plans/12): `bun run stack` connects it to the local fakes and installs the dealer & borrower
    // portal (scripts/demo-auto-finance.ts).
    domain: 'demo-auto',
    name: 'Demo Auto Finance',
    allowedDomains: ['demo-auto.localhost:3001'],
    pallette: { primary: '#0f766e', secondary: '#ecfdf5', accent: '#f97316' },
    extraRoles: [],
    users: [
      { email: 'admin@demo-auto.test', name: 'Adrian Admin', kind: 'member', roles: ['admin'] },
      { email: 'designer@demo-auto.test', name: 'Dee Designer', kind: 'member', roles: ['flow_designer'] },
      { email: 'underwriter@demo-auto.test', name: 'Uma Underwriter', kind: 'member', roles: ['reviewer'] },
      { email: 'funding@demo-auto.test', name: 'Frank Funding', kind: 'member', roles: ['senior_reviewer'] },
      { email: 'integrations@demo-auto.test', name: 'Ingrid Integrations', kind: 'member', roles: ['integration_manager'] },
      { email: 'dealer@sunrise-motors.test', name: 'Sam Sunrise', kind: 'client', roles: [] },
    ],
  },
  {
    domain: 'acme-credit',
    name: 'Acme Credit Union',
    allowedDomains: ['acme-credit.localhost:3001'],
    pallette: { primary: '#14532d', secondary: '#ecfdf5', accent: '#10b981' },
    extraRoles: [],
    users: [{ email: 'admin@acme-credit.test', name: 'Avery Admin', kind: 'member', roles: ['admin'] }],
  },
];

export async function seedDevelopmentData(urls: { app: string; platform: string }) {
  const password = process.env.SEED_PASSWORD || DEFAULT_SEED_PASSWORD;
  const passwordHash = await hashPassword(password);
  const databases = createDatabases(urls);

  try {
    const [staff] = await databases.platform.select().from(platformUsers).where(sql`lower(${platformUsers.email}) = 'staff@fintivio.local'`);
    if (staff && !staff.roles.includes('platform_admin')) {
      await databases.platform.update(platformUsers).set({ roles: ['platform_admin'] }).where(eq(platformUsers.id, staff.id));
    }
    if (!staff) {
      await databases.platform.insert(platformUsers).values({ email: 'staff@fintivio.local', name: 'Platform Staff', passwordHash, roles: ['platform_admin'] });
      console.log('seeded staff@fintivio.local');
    }
    // Staff always need a second factor: the seeded account gets a TOTP factor with a development secret
    // (`bun run totp` prints the current code; the e2e suite computes it from the same secret).
    const [staffRow] = await databases.platform.select().from(platformUsers).where(sql`lower(${platformUsers.email}) = 'staff@fintivio.local'`);
    const [factor] = await databases.platform.select({ id: platformMfaFactors.id }).from(platformMfaFactors).where(eq(platformMfaFactors.staffId, staffRow.id));
    if (!factor) {
      await databases.platform.insert(platformMfaFactors).values({
        staffId: staffRow.id, type: 'totp', secretCiphertext: encryptSecret(DEV_STAFF_TOTP_SECRET, `mfa:platform:${staffRow.id}`), recoveryCodes: [],
      });
      console.log(`seeded a TOTP factor for staff@fintivio.local (development secret ${DEV_STAFF_TOTP_SECRET}; current code: bun run totp)`);
    }

    for (const spec of TENANTS) {
      let [tenant] = await databases.platform.select().from(tenants).where(eq(tenants.domain, spec.domain));
      if (!tenant) {
        tenant = await provisionTenant(databases, { domain: spec.domain, name: spec.name, allowedDomains: spec.allowedDomains, pallette: spec.pallette, country: 'US' });
        console.log(`seeded tenant ${spec.domain} (${tenant.id})`);
      }

      await syncSystemRoles(databases, tenant.id);
      const db = databases.forTenant(tenant.id);
      // Development convenience: the demo institutions do not require a second factor for members (new institutions do).
      await db.insert(tenantSecurityPolicies).values({ requireMfa: false, updatedByEmail: 'seed' }).onConflictDoNothing();
      if (spec.extraRoles.length) {
        await db.insert(roles).values(spec.extraRoles.map((r) => ({ ...r, description: r.name }))).onConflictDoNothing();
      }

      for (const user of spec.users) {
        const [existing] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${user.email}`);
        if (existing) continue;
        const [row] = await db.insert(users).values({ email: user.email, name: user.name, kind: user.kind, status: 'active', passwordHash }).returning();
        for (const key of user.roles) {
          const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.key, key));
          await db.insert(userRoles).values({ userId: row.id, roleId: role.id });
        }
        console.log(`seeded ${user.email} (${spec.domain})`);
      }
      if (spec.domain === 'demo-bank') await seedDemoContent(databases, tenant.id);
      if (spec.domain === 'demo-auto') await seedDealer(databases, tenant.id);
    }

    if (!process.env.SEED_PASSWORD) {
      console.log(`development password for all seeded accounts: ${DEFAULT_SEED_PASSWORD}`);
    }
  } finally {
    await databases.close();
  }
}
