import { injectable, inject } from "tsyringe";
import { Repository } from "typeorm";
import { KeyValue } from "../entities";
import { LogsService } from './logs.service';
import { TenantsService } from "./tenants.service";
import assert from "assert";
import { UsersService } from "./users.service";
import { Service } from "./service";

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
export class KeyValueService extends Service {
    private keyValueRepository: Repository<KeyValue> | null = null;

    static dependencies() {
        return [
            TenantsService,
            UsersService,
            LogsService
        ]
    }

    constructor(
        @inject(TenantsService) private tenantsService: TenantsService,
        @inject(UsersService) private usersService: UsersService,
        @inject(LogsService) private logs: LogsService
    ) {
        super();
    }

    async getRepository() {
        if (this.keyValueRepository) return this.keyValueRepository;
        const conn = await this.tenantsService.getContextualPlatformDBClient();
        this.keyValueRepository = conn.getRepository(KeyValue);
        return this.keyValueRepository;
    }

    async create(data: CreateKeyValueInput): Promise<KeyValue> {
        const repository = await this.getRepository();
        assert(repository, 'Key-value repository not found');
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

        const saved = await repository.save(keyValue);

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
        const user = await this.usersService.getSessionUser();
        const repository = await this.getRepository();
        assert(repository, 'Key-value repository not found');
        const keyValue = await repository.findOneOrFail({ where: { id } });

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

        const updated = await repository.save(keyValue);

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
        const user = await this.usersService.getSessionUser();
        const repository = await this.getRepository();
        assert(repository, 'Key-value repository not found');
        const keyValue = await repository.findOneOrFail({ where: { id } });

        await this.logs.info('Deleting key-value pair', {
            category: 'system',
            source: 'KeyValueService',
            userId: user?.userId,
            metadata: {
                id: keyValue.id,
                key: keyValue.key
            }
        });

        await repository.remove(keyValue);

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
        const repository = await this.getRepository();
        assert(repository, 'Key-value repository not found');
        return repository.findOne({ where: { id } });
    }

    async findByKey(key: string): Promise<KeyValue | null> {
        const repository = await this.getRepository();
        assert(repository, 'Key-value repository not found');
        return repository.findOne({ where: { key } });
    }

    async findAll(): Promise<KeyValue[]> {
        const repository = await this.getRepository();
        assert(repository, 'Key-value repository not found');
        return repository.find();
    }

    async findByKeys(keys: string[]): Promise<KeyValue[]> {
        const repository = await this.getRepository();
        assert(repository, 'Key-value repository not found');
        return repository.find({
            where: keys.map(key => ({ key }))
        });
    }
}