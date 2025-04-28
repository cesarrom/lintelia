

import { events, ProofOfLifeNodeData, ProofOfLifeNodeDataSchema } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import assert from "assert";
import { ExecutableNode, ExecuteNodeFunctionProps } from "@/app/(modules)/(private)/(workflows)/types";
import { workflowToYaml, yamlToWorkflow } from "@/app/(modules)/(private)/(workflows)/(components)/yaml/converter";
import { workflowInject } from "@/lib/injector/utils";
import { WorkflowExecutionsService } from "@/lib/services/workflow-executions.service";
import { TriggerBuilder } from "@/lib/triggers-utils";
import { KeyValueService } from "@/lib/services/key-value.service";
import { FormsService } from "@/lib/services/forms.service";

const DEFAULT_MIN_CONFIDENCE_SCORE = 0.5;
const DEFAULT_MAX_ATTEMPTS = 3;

// TODO: this logic is potentially broken now, because it is modifying the yaml, and maybe it was assuming that `nextOrEndExecution` was going to use that yaml, but now, that function fetches the yaml from db
export const proofOfLifeService = restate.object({
  name: "proofOfLife",
  handlers: {
    executeNode: workflowInject(
      [WorkflowExecutionsService, KeyValueService, FormsService],
      async ({ tenant, user }, [workflowExecutionsService, keyValueService, formsService], c: restate.ObjectContext, args: ExecuteNodeFunctionProps) => {
        assert(tenant, 'Tenant is required');
        const { executionId, nodeData, workflowId, yaml, domain, token, result: r, resumableId, resumableResult } = args;

        const configRef = await c.run('validate-config', async () => {
          return ProofOfLifeNodeDataSchema.parse(nodeData.config || {});
        });

        const variables = await c.run('get-variables', () => {
          return workflowExecutionsService.getConfiguration(configRef, r);
        });

        const { minConfidenceScore = DEFAULT_MIN_CONFIDENCE_SCORE, maxAttempts = DEFAULT_MAX_ATTEMPTS, attempt = 1, requireDeviceInfo, requireLocation } = variables as ProofOfLifeNodeData;

        if (!resumableId) {
          const uuid = c.rand.uuidv4();
          const ID = `proof-of-life/${uuid}`;
          // Create a form instance with the interpolated variables
          await c.run('create-proof-of-life', async () => {
            return keyValueService.create({
              key: ID,
              value: JSON.stringify(variables),
              createdBy: user?.userId || 'System',
            });
          });


          // Create a resumable that when triggered, calls this same node again, hopefully with resumableId and resumableResult
          await workflowExecutionsService.createResumable(
            {
              ...args,
              event: args.sourceEvent,
              localResult: { id: ID, attempt },
              nextNodes: [nodeData],
              globalResult: r
            },
            new TriggerBuilder(ID)
              .matchMessage('Proof of life submitted')
              .matchCategory('user')
              .matchLevel('info')
              .matchMetadata(['metadata', 'id'], ID)
          );

          const localResult = { url: `https://${domain}.${env.DOMAIN}/proof-of-life/${uuid}/run`, id: ID };

          // Emit the public URL event first
          return await workflowExecutionsService.nextOrEndExecution({
            nodeData,
            event: events.publicUrl,
            executionId,
            localResult,
            globalResult: r,
            workflowId,
            domain,
            token
          });
        }

        const { confidenceScore = 0, location, ip, deviceInfo } = resumableResult as { confidenceScore: number; location: { lat: number; lng: number; }; ip: string; deviceInfo: object };

        let passed = confidenceScore >= minConfidenceScore && (requireLocation ? location : true) && (requireDeviceInfo ? deviceInfo : true);
        
        const formId = c.rand.uuidv4();

        const { form, instance, answer } = await c.run('create-form-with-answers', async () => {
          return formsService.createFormWithAnswers(
            {
              name: 'Proof of Life',
              description: '',
              createdBy: user?.userId || 'System',
              config: {
                id: formId,
                name: 'Proof of Life',
                description: '',
                variables: {},
                components: [
                  {
                    id: 'confidenceScore',
                    type: 'text',
                    config: {
                      type: 'text',
                      propertyName: 'confidenceScore',
                      label: 'Confidence Score',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: ''
                    }
                  },
                  {
                    id: 'location_lat',
                    type: 'number',
                    config: {
                      type: 'number',
                      propertyName: 'location_lat',
                      label: 'Location Latitude',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: ''
                    }
                  },
                  {
                    id: 'location_lng',
                    type: 'number',
                    config: {
                      type: 'number',
                      propertyName: 'location_lng',
                      label: 'Location Longitude',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: ''
                    }
                  },
                  {
                    id: 'ip',
                    type: 'text',
                    config: {
                      label: 'IP',
                      type: 'text',
                      propertyName: 'ip',
                      required: true,
                      description: '',
                      validation: {},
                      placeholder: ''
                    }
                  },
                  {
                    id: 'passed',
                    type: 'checkbox',
                    config: {
                      text: 'Passed',
                      type: 'checkbox',
                      defaultChecked: !!passed,
                      label: 'Passed',
                      propertyName: 'checkbox',
                      required: true,
                      description: '',
                    }
                  }
                ],
              },
            },
            {
              confidenceScore,
              location_lat: location.lat,
              location_lng: location.lng,
              ip,
              passed
            }
          );
        });

        if (passed) {
          return workflowExecutionsService.nextOrEndExecution({ nodeData, event: events.success, executionId, globalResult: r, localResult: { form_id: form.id, instance_id: instance.id, answers_id: answer.id }, workflowId, domain, token });
        }

        if (maxAttempts <= attempt) {
          return workflowExecutionsService.nextOrEndExecution({ nodeData, event: events.failure, executionId, globalResult: r, localResult: { form_id: form.id, instance_id: instance.id, answers_id: answer.id }, workflowId, domain, token });
        }

        // re attempt is by calling ourselves again, but with a decremented maxAttempts
        const client = c.objectClient<ExecutableNode>({ name: nodeData.type }, c.key) as { executeNode: (p: ExecuteNodeFunctionProps) => Promise<Record<string, unknown>> };

        const workflow = yamlToWorkflow(yaml);

        for (const node of workflow.nodes) {
          if (node.data.id === nodeData.id) {
            node.data.config = node.data.config ?? {};
            node.data.config.attempt = attempt + 1;
          }
        }

        const newYaml = workflowToYaml(workflow.workflow, workflow.nodes, workflow.edges, workflow.triggers);

        return await client.executeNode({ executionId, nodeData, workflowId,yaml: newYaml, domain, token, result: r, sourceEvent: events.reAttemptUrl }) || {};
      }
    ),
  }
});

export type ProofOfLifeService = typeof proofOfLifeService;