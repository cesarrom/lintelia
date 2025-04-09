import { yamlToWorkflow } from "@/app/(modules)/(private)/(workflows)/(components)/yaml/converter";
import { NodeData } from "@/app/(modules)/(private)/(workflows)/(components)/yaml/types";
import { ExecutableNode, ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { set } from "lodash";
import Mustache from 'mustache';

export const serveRestate = (endpoint: ReturnType<typeof restate.endpoint>) => {
  const { fetch } = endpoint.handler();
  return {
    POST: (req: Request) => {
      return fetch(req);
    },
    GET: (req: Request) => {
      return fetch(req);
    },
  };
};