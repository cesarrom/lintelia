import { auth } from "../clients/auth.client";
import { Service } from "./service";
import { injectable, singleton } from 'tsyringe';


@injectable()
@singleton()
export class AuthService extends Service {
  static dependencies() {
    return [];
  }

  get auth() {
    return auth;
  }
}