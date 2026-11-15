import { WebService } from "../../services/web.service";


export const USER = Symbol.for("USER");
export const USER_PROVIDER = {
  provide: USER,
  inject: [WebService],
  useFactory: async (webService: WebService) => {
    return webService.getSessionUser();
  }
}