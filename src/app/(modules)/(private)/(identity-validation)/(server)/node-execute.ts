

import { events, IdentityValidationNodeData, IdentityValidationNodeDataSchema } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { getConfiguration, nextOrEndExecution } from "@/lib/restate-utils";
import { Check, ComplyCube } from "@complycube/api";
import { downloadFile } from '../../(shared)/(actions)/files';
import assert from "assert";
import { ExecuteNodeFunctionProps } from "../../(workflows)/types";
import { Tenant } from "@/lib/entities/global";
import { getInjector } from "@/lib/injector";
import { TENANT_TOKEN } from "@/lib/injector/tokens";

export const identityValidationService = restate.object({
  name: "identityValidation",
  handlers: {
    executeNode: async (c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
      const injector = await getInjector(domain);
      const tenant: Tenant = injector.resolve(TENANT_TOKEN);
      assert(tenant, 'Tenant is required');
      const configRef = await c.run('validate-config', async () => {
        return IdentityValidationNodeDataSchema.parse(nodeData.config || {});
      });

      const config = await getConfiguration(c, executionId, configRef, r) as IdentityValidationNodeData;

      // Create resolvable promise for document upload URL
      const resolvablePromise = c.awakeable<{ frontImage: string, backImage?: string, selfie?: string }>();

      const publicUrl = `${process.env.NEXT_PUBLIC_URL}/identity-validation?promiseId=${resolvablePromise.id}`;

      await nextOrEndExecution(c, { nodeData, event: events.publicUrl, executionId, globalResult: r, localResult: { url: publicUrl }, yaml, domain, token });

      // Wait for user to upload images
      const uploadedFiles = await resolvablePromise.promise;

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
      const frontImageFile = await downloadFile(uploadedFiles.frontImage!);
      await c.run('upload-front', async () => {
        await complycube.document.upload(document.id, {
          data: frontImageFile.Body,
          fileName: "front.jpg"
        }, "front");
      });

      // Upload back image if provided
      if (uploadedFiles.backImage) {
        const backImageFile = await downloadFile(uploadedFiles.backImage!);
        await c.run('upload-back', async () => {
          await complycube.document.upload(document.id, {
            data: backImageFile.Body,
            fileName: "back.jpg"
          }, "back");
        });
      }

      // Upload selfie if required and provided
      let livePhotoId: string | undefined;

      if (config.validateFace && uploadedFiles.selfie) {
        const selfieFile = await downloadFile(uploadedFiles.selfie);
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

      return nextOrEndExecution(c, { nodeData, event: events.success, executionId, globalResult: r, localResult: result, yaml, domain, token });
    }
  }
});

export type IdentityValidationService = typeof identityValidationService;