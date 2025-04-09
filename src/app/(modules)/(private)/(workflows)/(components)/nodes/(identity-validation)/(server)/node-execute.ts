

import { events, IdentityValidationNodeData, IdentityValidationNodeDataSchema } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { Check, ComplyCube } from "@complycube/api";
import assert from "assert";
import { ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { downloadFile } from "@/app/(modules)/(private)/(shared)/(actions)/files";
import { workflowInject } from "@/lib/injector/utils";
import { WorkflowExecutionsService } from "@/lib/services";

export const identityValidationService = restate.object({
  name: "identityValidation",
  handlers: {
    executeNode: workflowInject(
      [WorkflowExecutionsService],
      async ({ tenant }, [workflowExecutionsService], c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
        assert(tenant, 'Tenant is required');

        const configRef = await c.run('validate-config', async () => {
          return IdentityValidationNodeDataSchema.parse(nodeData.config || {});
        });

        const config = workflowExecutionsService.getConfiguration(configRef, r) as IdentityValidationNodeData;

        const complycube = new ComplyCube({ apiKey: process.env.COMPLYCUBE_API_KEY! });

        // Create client
        const client = await complycube.client.create({
          type: "person",
          personDetails: {
            firstName: "", // Will be extracted from document
            lastName: ""  // Will be extracted from document
          }
        });

        // Create document
        const document = await c.run('create-document', async () => {
          return complycube.document.create(client.id, {
            type: config.documentType
          });
        });

        // Upload front image
        const frontImageFile = await downloadFile(config.frontFile!);
        await c.run('upload-front', async () => {
          await complycube.document.upload(document.id, {
            data: frontImageFile.Body,
            fileName: "front.jpg"
          }, "front");
        });

        // Upload back image if provided
        if (config.backFile) {
          const backImageFile = await downloadFile(config.backFile!);
          await c.run('upload-back', async () => {
            await complycube.document.upload(document.id, {
              data: backImageFile.Body,
              fileName: "back.jpg"
            }, "back");
          });
        }

        // Upload selfie if required and provided
        let livePhotoId: string | undefined;

        if (config.selfieFile) {
          const selfieFile = await downloadFile(config.selfieFile);
          const livePhoto = await c.run('upload-selfie', async () => {
            return complycube.livePhoto.upload(client.id, {
              data: selfieFile.Body
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

        return workflowExecutionsService.nextOrEndExecution({ nodeData, event: events.validationCompleted, executionId, globalResult: r, localResult: result, yaml, domain, token });
      }
    ),
  }
});

export type IdentityValidationService = typeof identityValidationService;