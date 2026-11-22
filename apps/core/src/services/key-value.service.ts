import { LogsService } from './logs.service';
import assert from "assert";
import { AbstractService } from "./service";
import { v4 as uuid } from 'uuid';
import { sysKeyValues } from "../entities/tenants";
import { eq, inArray } from "drizzle-orm";
import { WebService } from "./web.service";
import { CreateKeyValueInput, KeyValue, UpdateKeyValueInput } from "@repo/lintelia/schemas";
import { TENANT_CONNECTION } from "../injector/tokens/tenant-connection.token";
import { type TenantDatabase } from "../clients/database.client";
import { Injectable, Inject, Scope } from "@nestjs/common";


@Injectable({
  scope: Scope.REQUEST
})
export class KeyValueService extends AbstractService {

    constructor(
        @Inject(TENANT_CONNECTION) private db: TenantDatabase,
        @Inject(WebService) private webService: WebService,
        @Inject(LogsService) private logs: LogsService
    ) {
        super();
    }

    async create(data: CreateKeyValueInput): Promise<KeyValue> {
        const keyValue = {
            id: uuid(),
            key: data.key,
            value: data.value,
            description: data.description,
            createdBy: data.createdBy
        };

        await this.logs.info('Creating new key-value pair', {
            category: 'system',
            source: 'KeyValueService',
            userId: data.createdBy,
            metadata: {
                key: keyValue.key,
                value: keyValue.value
            }
        });

        const [saved] = await this.db.insert(sysKeyValues).values(keyValue).returning().execute();

        await this.logs.info('Key-value pair created', {
            category: 'system',
            source: 'KeyValueService',
            userId: data.createdBy,
            metadata: {
                id: saved.id,
                key: saved.key
            }
        });

        return saved;
    }

    async update(id: string, data: UpdateKeyValueInput): Promise<KeyValue> {
        const user = await this.webService.getSessionUser();
        const [keyValue] = await this.db.select().from(sysKeyValues).where(eq(sysKeyValues.id, id)).limit(1).execute();
        assert(keyValue, 'Key-value pair not found');

        if (data.value !== undefined) {
            keyValue.value = data.value;
        }
        if (data.description !== undefined) {
            keyValue.description = data.description;
        }

        await this.logs.info('Updating key-value pair', {
            category: 'system',
            source: 'KeyValueService',
            userId: user?.userId,
            metadata: {
                id: keyValue.id,
                key: keyValue.key,
                newValue: data.value
            }
        });

        const [updated] = await this.db.update(sysKeyValues).set(keyValue).where(eq(sysKeyValues.id, id)).returning().execute();

        await this.logs.info('Key-value pair updated', {
            category: 'system',
            source: 'KeyValueService',
            userId: user?.userId,
            metadata: {
                id: updated.id,
                key: updated.key
            }
        });

        return updated;
    }

    async delete(id: string): Promise<void> {
        const user = await this.webService.getSessionUser();
        const [keyValue] = await this.db.select().from(sysKeyValues).where(eq(sysKeyValues.id, id)).limit(1).execute();
        assert(keyValue, 'Key-value pair not found');

        await this.logs.info('Deleting key-value pair', {
            category: 'system',
            source: 'KeyValueService',
            userId: user?.userId,
            metadata: {
                id: keyValue.id,
                key: keyValue.key
            }
        });

        await this.db.delete(sysKeyValues).where(eq(sysKeyValues.id, id)).execute();

        await this.logs.info('Key-value pair deleted', {
            category: 'system',
            source: 'KeyValueService',
            userId: user?.userId,
            metadata: {
                id: keyValue.id,
                key: keyValue.key
            }
        });
    }

    async findById(id: string): Promise<KeyValue | null> {
        const [keyValue] = await this.db.select().from(sysKeyValues).where(eq(sysKeyValues.id, id)).limit(1).execute();
        return keyValue;
    }

    async findByKey(key: string): Promise<KeyValue | null> {
        const [keyValue] = await this.db.select().from(sysKeyValues).where(eq(sysKeyValues.key, key)).limit(1).execute();
        return keyValue;
    }

    async findAll(): Promise<KeyValue[]> {
        return this.db.select().from(sysKeyValues).execute();
    }

    async findByKeys(keys: string[]): Promise<KeyValue[]> {
        return this.db.select().from(sysKeyValues).where(inArray(sysKeyValues.key, keys)).execute();
    }
}