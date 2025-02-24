import { injectable, inject, singleton } from "tsyringe";
import { TENANT_TOKEN } from "../injector/tokens";
import { Tenant } from "../entities/global";

@injectable()
@singleton()
export class EventsService {
  constructor(@inject(TENANT_TOKEN) private _tenant: Tenant) { }

  async logEvent(eventName: string, payload: Record<string, unknown>) {
    try {
      await fetch('/api/workflows/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'event',
          domain: this._tenant.domain,
          eventName,
          payload,
          createdAt: Date.now()
        })
      });

      console.log(`Event ${eventName} logged successfully for domain ${this._tenant.domain}`);
    } catch (error) {
      console.error('Failed to log event:', error);
    }
  }
}
