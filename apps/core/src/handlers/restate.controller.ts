import * as restate from "@restatedev/restate-sdk/fetch";
import { WorkflowService } from "../services/restate/workflow";
import { SchedulerService } from "../services/restate/scheduler";
import { ConditionalService } from "../services/restate/conditional";
import { DecisionTableService } from "../services/restate/decision-table";
import { DocumentExtractorService } from "../services/restate/document-extractor";
import { IteratorService } from "../services/restate/iterator";
import { MapperService } from "../services/restate/mapper";
import { DatabaseService } from "../services/restate/database";
import { FormService } from "../services/restate/form";
import { IdentityValidationService } from "../services/restate/identity-validation";
import { ApiService } from "../services/restate/api";
import { ProofOfLifeService } from "../services/restate/proof-of-life";
import { WizardService } from "../services/restate/wizard";
import { EmailService } from "../services/restate/email";
import { EndService } from "../services/restate/end";
import { LogService } from "../services/restate/logs";
import { ReviewService } from "../services/restate/reviews";
import { RoleService } from "../services/restate/roles";
import { RestateService } from "../services/restate/restate.abstract.service";
import { UserService } from "../services/restate/users";
import { SystemService } from "../services/restate/system";
import { TenantService } from "../services/restate/tenant";
import { AuthService } from "../services/restate/auth";
import { All, Controller, Inject, Res, Scope } from '@nestjs/common';
import type { Context } from "hono";
import { type AppRequest, REQUEST_PROXY } from "../injector/tokens/request-proxy.token";
@Controller({
  path: '/restate',
  scope: Scope.REQUEST
})
export class RestateHandler {
  fetch: (req: Request) => Promise<Response>;

  constructor(
    @Inject(DatabaseService) databaseService: DatabaseService,
    @Inject(FormService) formService: FormService,
    @Inject(LogService) logService: LogService,
    @Inject(ProofOfLifeService) proofOfLifeService: ProofOfLifeService,
    @Inject(ReviewService) reviewService: ReviewService,
    @Inject(RoleService) roleService: RoleService,
    @Inject(UserService) userService: UserService,
    @Inject(SystemService) systemService: SystemService,
    @Inject(TenantService) tenantService: TenantService,
    @Inject(WorkflowService) workflowService: WorkflowService,
    @Inject(ApiService) apiService: ApiService,
    @Inject(ConditionalService) conditionalService: ConditionalService,
    @Inject(DecisionTableService) decisionTableService: DecisionTableService,
    @Inject(DocumentExtractorService) documentExtractorService: DocumentExtractorService,
    @Inject(EmailService) emailService: EmailService,
    @Inject(EndService) endService: EndService,
    @Inject(IdentityValidationService) identityValidationService: IdentityValidationService,
    @Inject(IteratorService) iteratorService: IteratorService,
    @Inject(MapperService) mapperService: MapperService,
    @Inject(SchedulerService) schedulerService: SchedulerService,
    @Inject(WizardService) wizardService: WizardService,
    @Inject(AuthService) authService: AuthService,
    @Inject(REQUEST_PROXY) private readonly requestProxy: AppRequest,
  ) {
    const endpoint = restate.endpoint();

    RestateService.bindAll(
      endpoint,
      databaseService,
      formService,
      logService,
      proofOfLifeService,
      reviewService,
      roleService,
      userService,
      systemService,
      tenantService,
      workflowService,
      apiService,
      conditionalService,
      decisionTableService,
      documentExtractorService,
      emailService,
      endService,
      identityValidationService,
      iteratorService,
      mapperService,
      schedulerService,
      wizardService,
      authService,
    );

    const { fetch } = endpoint.handler();

    this.fetch = fetch;
  }

  @All('/*')
  async any(@Res() ctx: Context) {
    const res = await this.fetch(this.requestProxy);
    ctx.res = res;
    return;
  }
}
