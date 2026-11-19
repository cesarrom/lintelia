import { Injectable } from '@nestjs/common';
import { WorkOS } from '@workos-inc/node';
import { env } from '../../constants';

/**
 * The SSO broker port (docs/plans/02): enterprise connections are configured by each institution's IT in the
 * broker's Admin Portal; we only ask for authorization URLs, exchange codes for profiles and read the organization's
 * state. One adapter: WorkOS (`@workos-inc/node`), pointed at the WorkOS emulator locally.
 */
export interface SsoProfile {
  id: string;
  idpId: string;
  organizationId: string | null;
  connectionId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  groups: string[];
  rawAttributes: Record<string, unknown>;
}

export interface SsoOrganizationState {
  id: string;
  domains: Array<{ domain: string; state: string }>;
  connections: Array<{ id: string; type: string; state: string; name: string }>;
}

export interface SsoBroker {
  createOrganization(input: { name: string; externalId: string }): Promise<string>;
  deleteOrganization(organizationId: string): Promise<void>;
  organization(organizationId: string): Promise<SsoOrganizationState>;
  setupLink(organizationId: string, intent: 'sso' | 'domain_verification', returnUrl: string): Promise<string>;
  authorizationUrl(input: { organizationId: string; redirectUri: string; state: string; loginHint?: string }): string;
  profile(code: string): Promise<SsoProfile>;
  directoryEvents(organizationId: string, after: string | null): Promise<{ events: DirectoryEvent[]; cursor: string | null }>;
  /** The directory groups a directory user belongs to now (roles from the IdP, docs/plans/15 §5.4). */
  userGroups(directoryUserId: string): Promise<Array<{ id: string; name: string }>>;
}

/** A provisioning change from the IdP's directory (SCIM through the broker's Directory Sync). */
export interface DirectoryEvent {
  id: string;
  type: 'dsync.user.created' | 'dsync.user.updated' | 'dsync.user.deleted' | 'dsync.group.user_added' | 'dsync.group.user_removed';
  user: { id: string; email: string; firstName: string | null; lastName: string | null; state: string; rawAttributes?: Record<string, unknown>; customAttributes?: Record<string, unknown> };
  /** Membership events: the group concerned. */
  group?: { id: string; name: string };
}

export const SSO_BROKER = Symbol.for('SSO_BROKER');

@Injectable()
export class WorkOsSsoBroker implements SsoBroker {
  private readonly workos = new WorkOS(env.WORKOS_API_KEY, {
    clientId: env.WORKOS_CLIENT_ID, apiHostname: env.WORKOS_API_HOSTNAME, https: env.WORKOS_HTTPS, ...(env.WORKOS_PORT ? { port: env.WORKOS_PORT } : {}),
  });

  async createOrganization(input: { name: string; externalId: string }) {
    const organization = await this.workos.organizations.createOrganization({ name: input.name, externalId: input.externalId });
    return organization.id;
  }

  async deleteOrganization(organizationId: string) {
    await this.workos.organizations.deleteOrganization(organizationId);
  }

  async organization(organizationId: string): Promise<SsoOrganizationState> {
    const organization = await this.workos.organizations.getOrganization(organizationId);
    const connections = await this.workos.sso.listConnections({ organizationId });
    return {
      id: organization.id,
      domains: organization.domains.map((d) => ({ domain: d.domain, state: String(d.state) })),
      connections: connections.data.map((c) => ({ id: c.id, type: String(c.type), state: String(c.state), name: c.name })),
    };
  }

  async setupLink(organizationId: string, intent: 'sso' | 'domain_verification', returnUrl: string) {
    const { link } = await this.workos.adminPortal.generateLink({ organization: organizationId, intent: intent as never, returnUrl });
    return link;
  }

  authorizationUrl(input: { organizationId: string; redirectUri: string; state: string; loginHint?: string }) {
    return this.workos.sso.getAuthorizationUrl({ organization: input.organizationId, redirectUri: input.redirectUri, state: input.state, clientId: env.WORKOS_CLIENT_ID, loginHint: input.loginHint });
  }

  async directoryEvents(organizationId: string, after: string | null) {
    const list = await this.workos.events.listEvents({
      events: ['dsync.user.created', 'dsync.user.updated', 'dsync.user.deleted', 'dsync.group.user_added', 'dsync.group.user_removed'], organizationId, ...(after ? { after } : {}), limit: 100,
    } as never);
    type DirectoryUserData = { id: string; email: string; firstName: string | null; lastName: string | null; state: string; rawAttributes?: Record<string, unknown>; customAttributes?: Record<string, unknown> };
    const userOf = (user: DirectoryUserData) => ({
      id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, state: user.state,
      rawAttributes: user.rawAttributes ?? {}, customAttributes: user.customAttributes ?? {},
    });
    const events = list.data.map((event): DirectoryEvent => {
      const type = event.event as DirectoryEvent['type'];
      if (type === 'dsync.group.user_added' || type === 'dsync.group.user_removed') {
        const data = (event as unknown as { data: { user: DirectoryUserData; group: { id: string; name: string } } }).data;
        return { id: event.id, type, user: userOf(data.user), group: { id: data.group.id, name: data.group.name } };
      }
      return { id: event.id, type, user: userOf((event as unknown as { data: DirectoryUserData }).data) };
    });
    return { events, cursor: events.at(-1)?.id ?? after };
  }

  async userGroups(directoryUserId: string) {
    const groups = await this.workos.directorySync.listGroups({ user: directoryUserId, limit: 100 });
    return (await groups.autoPagination()).map((g) => ({ id: g.id, name: g.name }));
  }

  async profile(code: string): Promise<SsoProfile> {
    const { profile } = await this.workos.sso.getProfileAndToken({ code, clientId: env.WORKOS_CLIENT_ID });
    return {
      id: profile.id, idpId: profile.idpId, organizationId: profile.organizationId ?? null, connectionId: profile.connectionId, email: profile.email,
      firstName: profile.firstName ?? null, lastName: profile.lastName ?? null, groups: (profile.groups as string[] | undefined) ?? [],
      rawAttributes: (profile.rawAttributes as Record<string, unknown> | undefined) ?? {},
    };
  }
}
