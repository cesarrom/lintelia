

import { events, IdentityValidationNodeData, IdentityValidationNodeDataSchema } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { Check, ComplyCube } from "@complycube/api";
import assert from "assert";
import { ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { downloadFileContents } from "@/app/(modules)/(private)/(shared)/(actions)/files";
import { workflowInject } from "@/lib/injector/utils";
import { FormsService } from "@/lib/services/forms.service";
import { blobToBase64, compressBlobUntil } from "@/lib/file-utils";
import { WorkflowExecutionsService } from "@/lib/services/workflow-executions.service";

export const identityValidationService = restate.object({
  name: "identityValidation",
  handlers: {
    executeNode: workflowInject(
      [WorkflowExecutionsService, FormsService],
      async ({ tenant, user }, [workflowExecutionsService, formsService], c: restate.ObjectContext, { executionId, nodeData, workflowId, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        assert(user, 'User is required');
        assert(tenant, 'Tenant is required');

        const configRef = await c.run('validate-config', async () => {
          return IdentityValidationNodeDataSchema.parse(nodeData.config || {});
        });

        const config = workflowExecutionsService.getConfiguration(configRef, r) as IdentityValidationNodeData;

        const complycube = new ComplyCube({ apiKey: process.env.COMPLYCUBE_API_KEY! });

        // Create client
        const client = await complycube.client.create({
          type: "person",
          email: user.email!,
          personDetails: {
            firstName: user.givenName!,
            lastName: user.familyName!
          }
        });

        // Create document
        const document = await c.run('create-document', async () => {
          return complycube.document.create(client.id, {
            type: config.documentType
          });
        });

        // Upload front image
        
        await c.run('upload-front', async () => {
          const frontImageFile = await downloadFileContents(config.frontFile!);
          // max 4MB
          const blob = await compressBlobUntil(
            await frontImageFile.blob(),
            4 * 1024 * 1024,
            0.5
          );

          const data = await blobToBase64(blob);

          await complycube.document.upload(document.id, {
            data,
            fileName: config.frontFile!,
          }, "front");
        });

        // Upload back image if provided
        if (config.backFile) {
          await c.run('upload-back', async () => {
            const backImageFile = await downloadFileContents(config.backFile!);

            // max 4MB
            const blob = await compressBlobUntil(
              await backImageFile.blob(),
              4 * 1024 * 1024,
              0.5
            );

            const data = await blobToBase64(blob);
            
            await complycube.document.upload(document.id, {
              data,
              fileName: config.backFile!,
            }, "back");
          });
        }

        // Upload selfie if required and provided
        let livePhotoId: string | undefined;

        if (config.selfieFile) {
          const livePhoto = await c.run('upload-selfie', async () => {
            const selfieFile = await downloadFileContents(config.selfieFile!);
            // max 4MB
            const blob = await compressBlobUntil(
              await selfieFile.blob(),
              4 * 1024 * 1024,
              0.5
            );

            const data = await blobToBase64(blob);

            return complycube.livePhoto.upload(client.id, {
              data
            });
          });
          livePhotoId = livePhoto.id;
        }

        // Create and wait for check
        const check = await c.run('create-check', async () => {
          const checkData = {
            documentId: document.id,
            type: "identity_check",
            livePhotoId: livePhotoId
          };
          return complycube.check.create(client.id, checkData);
        });

        await c.sleep(30000)

        // Poll for check completion
        const result = await c.run('get-result', async () => {
          let checkResult: Check;
          do {
            checkResult = await complycube.check.get(check.id);
            if (checkResult.status !== 'complete') {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } while (checkResult.status !== 'complete');
          return checkResult;
        });

        assert(result.status === 'complete', 'Check did not complete');

        const formId = c.rand.uuidv4();

        const { form, instance, answer } = await c.run('create-form-with-answers', async () => {
          return formsService.createFormWithAnswers(
            {
              name: 'Identity Validation',
              description: '',
              createdBy: user?.userId || 'System',
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

        return workflowExecutionsService.nextOrEndExecution({
          nodeData, event: events.validationCompleted, executionId, globalResult: r, localResult: {
            result,
            form_id: form.id,
            instance_id: instance.id,
            answer_id: answer.id
          }, workflowId, domain, token
        });
      }
    ),
  }
});

export type IdentityValidationService = typeof identityValidationService;