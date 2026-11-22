import postgres, { type Sql } from 'postgres';

/**
 * The connector's own database (never shared with the core or other connectors). The SDK keeps installations,
 * encrypted secrets, idempotency records, replay protection and a small key-value store per installation; connectors
 * add their own tables with `migrations`.
 */
const SDK_MIGRATIONS: Array<{ name: string; sql: string }> = [
  {
    name: 'sdk-0001',
    sql: `
      create table if not exists sdk_installations (
        id text primary key,
        status text not null default 'pending',
        config jsonb not null default '{}',
        context jsonb not null default '{}',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
      create table if not exists sdk_data_keys (
        installation_id text primary key references sdk_installations(id) on delete cascade,
        wrapped bytea not null,
        created_at timestamptz not null default now()
      );
      create table if not exists sdk_secrets (
        installation_id text not null references sdk_installations(id) on delete cascade,
        name text not null,
        ciphertext bytea not null,
        iv bytea not null,
        tag bytea not null,
        set_at timestamptz not null default now(),
        primary key (installation_id, name)
      );
      create table if not exists sdk_idempotency (
        installation_id text not null references sdk_installations(id) on delete cascade,
        key text not null,
        response jsonb not null,
        created_at timestamptz not null default now(),
        primary key (installation_id, key)
      );
      create table if not exists sdk_seen_tokens (
        jti text primary key,
        expires_at timestamptz not null
      );
      create table if not exists sdk_kv (
        installation_id text not null references sdk_installations(id) on delete cascade,
        key text not null,
        value jsonb not null,
        updated_at timestamptz not null default now(),
        primary key (installation_id, key)
      );
    `,
  },
];

export async function openDatabase(url: string, migrations: Array<{ name: string; sql: string }> = []): Promise<Sql> {
  const sql = postgres(url, { max: 5, onnotice: () => { } });
  await sql`create table if not exists sdk_migrations (name text primary key, applied_at timestamptz not null default now())`;
  for (const migration of [...SDK_MIGRATIONS, ...migrations]) {
    const [done] = await sql`select 1 from sdk_migrations where name = ${migration.name}`;
    if (done) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(migration.sql);
      await tx`insert into sdk_migrations (name) values (${migration.name})`;
    });
  }
  return sql;
}

export interface InstallationRow {
  id: string;
  status: 'pending' | 'active' | 'failing';
  config: Record<string, unknown>;
  context: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

/** Per-installation key-value store in the connector's database (vendor session ids → callback tokens, …). */
export class KeyValueStore {
  constructor(private readonly sql: Sql, private readonly installationId: string) { }

  async get<T = unknown>(key: string): Promise<T | null> {
    const [row] = await this.sql`select value from sdk_kv where installation_id = ${this.installationId} and key = ${key}`;
    return row ? (row.value as T) : null;
  }

  async put(key: string, value: unknown) {
    await this.sql`insert into sdk_kv (installation_id, key, value) values (${this.installationId}, ${key}, ${this.sql.json(value as never)})
      on conflict (installation_id, key) do update set value = excluded.value, updated_at = now()`;
  }

  async delete(key: string) {
    await this.sql`delete from sdk_kv where installation_id = ${this.installationId} and key = ${key}`;
  }
}
