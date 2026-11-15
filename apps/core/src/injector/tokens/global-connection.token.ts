import { ConnectionService } from "../../services/connection.service";

export const GLOBAL_CONNECTION = Symbol.for("GLOBAL_CONNECTION");
export const GLOBAL_CONNECTION_PROVIDER = {
  provide: GLOBAL_CONNECTION,
  inject: [ConnectionService],
  useFactory: async (dbService: ConnectionService) => {
    return dbService.getGlobalConnection();
  }
};