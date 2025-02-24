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
import { resolvableService } from "@/app/(modules)/(private)/(shared)/(server)/node-execute";
import { formService } from "@/app/(modules)/(private)/(forms)/(server)/node-execute";
import { identityValidationService } from "@/app/(modules)/(private)/(identity-validation)/(server)/node-execute";
import { apiService } from "@/app/(modules)/(private)/(api)/(server)/node-execute";
import { proofOfLifeService } from "@/app/(modules)/(private)/(proof-of-life)/(server)/node-execute";
import { wizardService } from "@/app/(modules)/(private)/(wizard)/(server)/node-execute";
import { emailsService } from "@/app/(modules)/(private)/(emails)/(server)/node-execute";

const endpoint = restate.endpoint()
  .bind(workflowService)
  .bind(schedulerService)
  .bind(conditionalService)
  .bind(decisionTableService)
  .bind(documentExtractorService)
  .bind(iteratorService)
  .bind(mapperService)
  .bind(databaseService)
  .bind(resolvableService)
  .bind(formService)
  .bind(identityValidationService)
  .bind(apiService)
  .bind(proofOfLifeService)
  .bind(wizardService)
  .bind(emailsService);
  
export const { GET, POST } = serveRestate(endpoint);

