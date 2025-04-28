import { injectable, inject, singleton } from "tsyringe";
import { TenantsService } from "./tenants.service";
import { Service } from "./service";

@injectable()
@singleton()
export class EventsService extends Service {
  static dependencies() {
    return [
      TenantsService
    ]
  }

  constructor(@inject(TenantsService) private _tenantService: TenantsService) {
    super();
  }

  async logEvent(eventName: string, payload: Record<string, unknown>) {
    const domain = await this._tenantService.getCachedDomainFromTenant();
    try {
      await fetch('/api/workflows/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'event',
          domain,
          eventName,
          payload,
          createdAt: Date.now()
        })
      });

      console.log(`Event ${eventName} logged successfully for domain ${domain}`);
    } catch (error) {
      console.error('Failed to log event:', error);
    }
  }
}
