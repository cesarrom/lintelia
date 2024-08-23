import { SSTConfig } from "sst";
import { API } from "./stacks/Default";

export default {
  config(input) {
    return {
      name: "fintivio",
      removal: input?.stage === "production" ? "retain" : "remove",
      region: "us-east-1",
      home: "aws",
      providers: { aws: true },
    };
  },
  stacks(app) {
    app.stack(API);
  }
} satisfies SSTConfig;
