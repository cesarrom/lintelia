

import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import { Check, ComplyCube } from "@complycube/api";
import assert from "assert";
import { FormsService } from "../../services/forms.service";
import { WorkflowExecutionsService } from "../../services/workflow-executions.service";
import { IdentityValidationNodeConfig, identityValidationNodeConfigSchema, type User, type Tenant, WORKFLOW_EVENTS } from "@repo/fintivio/schemas";
import { ExecuteNodeFunctionProps } from "../../utils/restate-utils";
import { blobToBase64, compressBlobUntil } from "../../utils/file-utils";
import { FilesService } from "../files.service";
import { RestateService } from "./restate.abstract.service";
import { env } from "../../constants";
import { USER } from "../../injector/tokens/user.token";
import { TENANT } from "../../injector/tokens/tenant.token";
import { Inject, Scope, Injectable } from "@nestjs/common";

@Injectable({
  scope: Scope.REQUEST
})
export class IdentityValidationService extends RestateService<'identityValidation'> {
  static complyCube = new ComplyCube({ apiKey: env.COMPLYCUBE_API_KEY! });

  object = object({
    name: "identityValidation",
    handlers: {
      executeNode: async (c: ObjectContext, { executionId, nodeData, workflowId, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        assert(this.user, 'User is required');
        assert(this.tenant, 'Tenant is required');

        const configRef = await c.run('validate-config', async () => {
          return identityValidationNodeConfigSchema.parse(nodeData.config || {});
        });

        const config = this.workflowExecutionsService.getConfiguration(configRef, r) as IdentityValidationNodeConfig;

        // Create client
        const client = await c.run('create-client', async () => {
          return IdentityValidationService.complyCube.client.create({
            type: "person",
            email: this.user.email!,
            personDetails: {
              firstName: this.user.givenName!,
              lastName: this.user.familyName!
            }
          });
        });

        // Create document
        const document = await c.run('create-document', async () => {
          return IdentityValidationService.complyCube.document.create(client.id, {
            type: config.documentType,
            clientId: client.id,
            classification: 'proof_of_identity'
          });
        });

        const livePhotoId = await c.run('upload-files', async () => {
          const [livePhoto] = await Promise.all([
            config.selfieFile ? this.uploadSelfie(config.selfieFile!, client.id) : Promise.resolve(null),
            this.uploadDocumentImage(config.frontFile!, document.id, 'front'),
            config.backFile ? this.uploadDocumentImage(config.backFile!, document.id, 'back') : Promise.resolve(),
          ])

          if (livePhoto) {
            return livePhoto.id
          }

          return null;
        });

        // Create and wait for check
        const check = await c.run('create-check', async () => {
          const checkData = {
            documentId: document.id,
            type: "identity_check",
            livePhotoId: livePhotoId
          };
          return IdentityValidationService.complyCube.check.create(client.id, checkData);
        });

        await c.sleep(30000)

        // Poll for check completion
        const result = await c.run('get-result', async () => {
          let checkResult: Check;
          do {
            checkResult = await IdentityValidationService.complyCube.check.get(check.id);
            if (checkResult.status !== 'complete') {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } while (checkResult.status !== 'complete');
          return checkResult;
        });

        assert(result.status === 'complete', 'Check did not complete');

        const formId = c.rand.uuidv4();

        const { form, instance, answer } = await c.run('create-form-with-answers', async () => {
          return this.formsService.createFormWithAnswers(
            {
              name: 'Identity Validation',
              description: '',
              createdBy: this.user?.userId || 'System',
              config: {
                id: formId,
                name: 'Identity Validation',
                description: '',
                variables: {},
                components: [
                  {
                    id: 'result',
                    type: 'textarea',
                    config: {
                      type: 'textarea',
                      propertyName: 'result',
                      label: 'Result',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: '',
                      rows: 4
                    }
                  },
                  {
                    id: 'type',
                    type: 'text',
                    config: {
                      type: 'text',
                      propertyName: 'type',
                      label: 'Type',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: ''
                    }
                  },
                  {
                    id: 'status',
                    type: 'text',
                    config: {
                      type: 'text',
                      propertyName: 'status',
                      label: 'Status',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: ''
                    }
                  }
                ],
              },
            },
            {
              result: result.result! || 'No result',
              type: result.type,
              status: result.status,
            }
          );
        });

        return this.workflowExecutionsService.nextOrEndExecution(c, {
          nodeId: nodeData.id,
          event: WORKFLOW_EVENTS.identityValidation.validationCompleted,
          executionId,
          globalResult: r,
          workflowId,
          domain,
          token,
          localResult: {
            result,
            form_id: form.id,
            instance_id: instance.id,
            answer_id: answer.id
          },
        });
      },
    }
  });
  
  constructor(
    @Inject(FilesService) private filesService: FilesService,
    @Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService,
    @Inject(FormsService) private formsService: FormsService,
    @Inject(USER) private user: User,
    @Inject(TENANT) private tenant: Tenant,
  ) {
    super();
  }

  async downloadAndCompress(fileId: string) {
    const buffer = await this.filesService.downloadFile(fileId);
    const image = new File([buffer] as any, fileId);
    // max 4MB
    const blob = await compressBlobUntil(
      image,
      4 * 1024 * 1024,
      0.5
    );
  
    return await blobToBase64(blob);
  }
  
  async uploadDocumentImage(fileId: string, documentId: string, type: 'front' | 'back') {
    const data = await this.downloadAndCompress(fileId);
  
    await IdentityValidationService.complyCube.document.upload(documentId, {
      data,
      fileName: fileId,
    }, type);
  }
  
  async uploadSelfie(fileId: string, clientId: string) {
    const data = await this.downloadAndCompress(fileId);
  
    return IdentityValidationService.complyCube.livePhoto.upload(clientId, {
      data
    });
  }
}
  