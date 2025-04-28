import { cookies, headers } from "next/headers";
import { auth } from "../clients/auth.client";
import { Service } from "./service";
import { inject, injectable, singleton } from 'tsyringe';
import { session } from "@descope/nextjs-sdk/server";
import { AuthService } from "./auth.service";


@injectable()
@singleton()
export class WebService extends Service {
  private _mockedTenant: string | null = null;
  private _mockedDomain: string | null = null;
  private _mockUserId: string | null = null;

  static dependencies() {
    return [
      AuthService
    ];
  }

  constructor(
    @inject(AuthService) private authService: AuthService
  ) {
    super();
  }

  mockTenant(tenant: string) {
    this._mockedTenant = tenant;
  }

  mockDomain(domain: string) {
    this._mockedDomain = domain;
  }

  mockUserId(userId: string) {
    this._mockUserId = userId;
  }

  async getTenantAndDomain() {
    const headersList = await headers();
    const cookiesList = await cookies();
    const headerUrl = 'https://' + headersList.get('x-forwarded-host') || "";

    const url = new URL(headerUrl);
    // EX: https://galicia.fintivio.org/
    // tenant = galicia
    // domain = galicia.fintivio.org

    const tenant = this._mockedTenant || url.hostname.split(".")[0] || cookiesList.get('fintivio-domain')?.value;
    const domain = this._mockedDomain || url.hostname;

    return { tenant, domain };
  }

  async getUserId() {
    const s = await session();

    return this._mockUserId || s?.token?.sub || null;
  }
}