import { VirtualObjectDefinition, endpoint} from "@restatedev/restate-sdk/fetch";
import { AbstractService } from "../service";

export type RestateEndpoint = ReturnType<typeof endpoint>;

export abstract class RestateService<Name extends string> extends AbstractService {
  abstract get object(): VirtualObjectDefinition<Name, unknown>;

  bind(endpoint: RestateEndpoint) {
    endpoint.bind(this.object);
  }

  static bindAll(endpoint: RestateEndpoint, ...services: RestateService<any>[]) {
    services.forEach(s => {
      s.bind(endpoint);
    })
  }
}