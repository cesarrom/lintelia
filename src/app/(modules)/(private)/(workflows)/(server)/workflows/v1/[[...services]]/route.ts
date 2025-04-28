import * as restate from "@restatedev/restate-sdk/fetch";
import { serveRestate } from "@/lib/restate-utils";
import { workflowService } from "@/app/(modules)/(private)/(workflows)/(components)/nodes/(workflows)/(server)/node-execute";
import { schedulerService } from "@/app/(modules)/(private)/(workflows)/(components)/nodes/(scheduler)/(server)/node-execute";
import { conditionalService } from "@/app/(modules)/(private)/(workflows)/(components)/nodes/(conditional)/(server)/node-execute";
import { decisionTableService } from "@/app/(modules)/(private)/(workflows)/(components)/nodes/(decision-table)/(server)/node-execute";
import { documentExtractorService } from "@/app/(modules)/(private)/(workflows)/(components)/nodes/(document-extractor)/(server)/node-execute";
import { iteratorService } from "@/app/(modules)/(private)/(workflows)/(components)/nodes/(iterator)/(server)/node-execute";
import { mapperService } from "@/app/(modules)/(private)/(workflows)/(components)/nodes/(mapper)/(server)/node-execute";
import { databaseService } from "@/app/(modules)/(private)/(workflows)/(components)/nodes/(database)/(server)/node-execute";
import { formService } from "@/app/(modules)/(private)/(workflows)/(components)/nodes/(form)/(server)/node-execute";
import { identityValidationService } from "@/app/(modules)/(private)/(workflows)/(components)/nodes/(identity-validation)/(server)/node-execute";
import { apiService } from "@/app/(modules)/(private)/(workflows)/(components)/nodes/(api)/(server)/node-execute";
import { proofOfLifeService } from "@/app/(modules)/(private)/(workflows)/(components)/nodes/(proof-of-life)/(server)/node-execute";
import { wizardService } from "@/app/(modules)/(private)/(workflows)/(components)/nodes/(wizard)/(server)/node-execute";
import { emailsService } from "@/app/(modules)/(private)/(workflows)/(components)/nodes/(email)/(server)/node-execute";
import { endService } from "@/app/(modules)/(private)/(workflows)/(components)/nodes/(end)/(server)/node-execute";
import { fetchUserService } from "@/app/(modules)/(private)/(workflows)/(components)/nodes/(fetch-user)/(server)/node-execute";

const endpoint = restate.endpoint()
  .bind(workflowService)
  .bind(schedulerService)
  .bind(conditionalService)
  .bind(decisionTableService)
  .bind(documentExtractorService)
  .bind(iteratorService)
  .bind(mapperService)
  .bind(databaseService)
  .bind(formService)
  .bind(identityValidationService)
  .bind(apiService)
  .bind(proofOfLifeService)
  .bind(wizardService)
  .bind(endService)
  .bind(fetchUserService)
  .bind(emailsService);
  
export const { GET, POST } = serveRestate(endpoint);

