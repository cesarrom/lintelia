'use server';

import { inject } from "@/lib/injector/utils";
import { KeyValueService } from "@/lib/services/key-value.service";
import { ProofOfLifeNodeData } from "../../(workflows)/(components)/nodes/(proof-of-life)/types";
import assert from "assert";
import { LogsService } from "@/lib/services";

export const fetchProofOfLifeConfig = inject(
  [KeyValueService],
  async ({ user, tenant }, [keyValueService], uuid: string) => {
    assert(!!user, 'user is required');
    assert(!!tenant, 'tenant is required');

    const ID = `proof-of-life/${uuid}`;

    const keyValue = await keyValueService.findById(ID);

    if (!keyValue) {
      throw new Error('Key value not found');
    }

    const { value } = keyValue;

    return JSON.parse(value) as ProofOfLifeNodeData & { attempt: number };
  }
);

export const submitProofOfLife = inject(
  [LogsService],
  async ({ user, tenant }, [logsService], params: { uuid: string; location: { lat: number; lng: number; }; ip: string; confidence: number, deviceInfo: object }) => {
    assert(!!user, 'user is required');
    assert(!!tenant, 'tenant is required');

    const { uuid, location, ip, confidence, deviceInfo } = params;
    await logsService.info('Proof of life submitted', {
      category: 'user',
      metadata: {
        id: `proof-of-life/${uuid}`,
        uuid,
        location,
        ip,
        confidence,
        deviceInfo,
      }
    })
  }
);