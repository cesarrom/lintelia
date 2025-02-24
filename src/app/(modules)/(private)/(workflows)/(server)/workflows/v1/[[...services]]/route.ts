import "reflect-metadata";
import * as restate from "@restatedev/restate-sdk/fetch";
import { serveRestate } from "@/lib/restate-utils";
import { workflowService } from "@/app/(modules)/(private)/(workflows)/(server)/workflow-service";
import { schedulerService } from "@/app/(modules)/(private)/(scheduler)/(server)/node-execute";
import { conditionalService } from "@/app/(modules)/(private)/(conditional)/(server)/node-execute";
import { decisionTableService } from "@/app/(modules)/(private)/(decision-table)/(server)/node-execute";
import { documentExtractorService } from "@/app/(modules)/(private)/(document-extractor)/(server)/node-execute";
import { iteratorService } from "@/app/(modules)/(private)/(iterator)/(server)/node-execute";
import { mapperService } from "@/app/(modules)/(private)/(mapper)/(server)/node-execute";
import { databaseService } from "@/app/(modules)/(private)/(database)/(server)/node-execute";

const endpoint = restate.endpoint()
  .bind(workflowService)
  .bind(schedulerService)
  .bind(conditionalService)
  .bind(decisionTableService)
  .bind(documentExtractorService)
  .bind(iteratorService)
  .bind(mapperService)
  .bind(databaseService);
  
export const { GET, POST } = serveRestate(endpoint);

