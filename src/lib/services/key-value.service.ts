import { injectable, inject } from "tsyringe";
import { DataSource, Repository } from "typeorm";
import { TENANT_DB_TOKEN, USER_TOKEN } from "../injector/tokens";
import { KeyValue } from "../entities/tenant/key-value.entity";
import { LogsService } from './logs.service';
import { User } from "@/types/auth";

export interface CreateKeyValueInput {
    key: string;
    value: string;
    description?: string;
    createdBy: string;
}

export interface UpdateKeyValueInput {
    value?: string;
    description?: string;
}

@injectable()
export class KeyValueService {
    private keyValueRepository: Repository<KeyValue>;

    constructor(
        @inject(TENANT_DB_TOKEN) private conn: DataSource,
        @inject(USER_TOKEN) private user: User | null,
        @inject(LogsService) private logs: LogsService
    ) {
        this.keyValueRepository = this.conn.getRepository(KeyValue);
    }

    async create(data: CreateKeyValueInput): Promise<KeyValue> {
        const keyValue = new KeyValue();
        keyValue.key = data.key;
        keyValue.value = data.value;
        keyValue.description = data.description;
        keyValue.createdBy = data.createdBy;

        await this.logs.info('Creating new key-value pair', {
            category: 'system',
            source: 'KeyValueService',
            userId: data.createdBy,
            metadata: {
                key: keyValue.key,
                value: keyValue.value
            }
        });

        const saved = await this.keyValueRepository.save(keyValue);

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
        const keyValue = await this.keyValueRepository.findOneOrFail({ where: { id } });

        if (data.value !== undefined) {
            keyValue.value = data.value;
        }
        if (data.description !== undefined) {
            keyValue.description = data.description;
        }

        await this.logs.info('Updating key-value pair', {
            category: 'system',
            source: 'KeyValueService',
            userId: this.user?.userId,
            metadata: {
                id: keyValue.id,
                key: keyValue.key,
                newValue: data.value
            }
        });

        const updated = await this.keyValueRepository.save(keyValue);

        await this.logs.info('Key-value pair updated', {
            category: 'system',
            source: 'KeyValueService',
            userId: this.user?.userId,
            metadata: {
                id: updated.id,
                key: updated.key
            }
        });

        return updated;
    }

    async delete(id: string): Promise<void> {
        const keyValue = await this.keyValueRepository.findOneOrFail({ where: { id } });

        await this.logs.info('Deleting key-value pair', {
            category: 'system',
            source: 'KeyValueService',
            userId: this.user?.userId,
            metadata: {
                id: keyValue.id,
                key: keyValue.key
            }
        });

        await this.keyValueRepository.remove(keyValue);

        await this.logs.info('Key-value pair deleted', {
            category: 'system',
            source: 'KeyValueService',
            userId: this.user?.userId,
            metadata: {
                id: keyValue.id,
                key: keyValue.key
            }
        });
    }

    async findById(id: string): Promise<KeyValue | null> {
        return this.keyValueRepository.findOne({ where: { id } });
    }

    async findByKey(key: string): Promise<KeyValue | null> {
        return this.keyValueRepository.findOne({ where: { key } });
    }

    async findAll(): Promise<KeyValue[]> {
        return this.keyValueRepository.find();
    }

    async findByKeys(keys: string[]): Promise<KeyValue[]> {
        return this.keyValueRepository.find({
            where: keys.map(key => ({ key }))
        });
    }
}