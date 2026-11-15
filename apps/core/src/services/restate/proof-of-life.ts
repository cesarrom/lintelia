

import { type ObjectContext, object } from "@restatedev/restate-sdk/fetch";
import assert from "assert";
import { WorkflowExecutionsService } from "../../services/workflow-executions.service";
import { KeyValueService } from "../../services/key-value.service";
import { FormsService } from "../../services/forms.service";
import { ExecutableNode, ExecuteNodeFunctionProps } from "../../utils/restate-utils";
import { proofOfLifeNodeConfigSchema, ProofOfLifeNodeConfig, WORKFLOW_EVENTS, type User, type Tenant } from "@repo/fintivio/schemas";
import { TriggerBuilder, workflowToYaml, yamlToWorkflow } from "@repo/fintivio/utilities";
import { env } from "../../constants";
import { LogsService } from "../../services/logs.service";
import { RestateService } from "./restate.abstract.service";
import { USER } from "../../injector/tokens/user.token";
import { TENANT } from "../../injector/tokens/tenant.token";
import { Inject, Scope, Injectable } from "@nestjs/common";

const DEFAULT_MIN_CONFIDENCE_SCORE = 0.5;
const DEFAULT_MAX_ATTEMPTS = 3;

@Injectable({
  scope: Scope.REQUEST
})
export class ProofOfLifeService extends RestateService<'proofOfLife'> {
  object = object({
    name: "proofOfLife",
    handlers: {
      executeNode: async (c: ObjectContext, args: ExecuteNodeFunctionProps) => {
        assert(this.tenant, 'Tenant is required');
        const { executionId, nodeData, workflowId, yaml, domain, token, result: r, resumableId, resumableResult } = args;
  
        const configRef = await c.run('validate-config', async () => {
          return proofOfLifeNodeConfigSchema.parse(nodeData.config || {});
        });
  
        const variables = await c.run('get-variables', () => {
          return this.workflowExecutionsService.getConfiguration(configRef, r);
        });
  
        const { minConfidenceScore = DEFAULT_MIN_CONFIDENCE_SCORE, maxAttempts = DEFAULT_MAX_ATTEMPTS, attempt = 1, requireDeviceInfo, requireLocation } = variables as ProofOfLifeNodeConfig;
  
        if (!resumableId) {
          const uuid = c.rand.uuidv4();
          const ID = `proof-of-life/${uuid}`;
          // Create a form instance with the interpolated variables
          await c.run('create-proof-of-life', async () => {
            return this.keyValueService.create({
              key: ID,
              value: JSON.stringify(variables),
              createdBy: this.user?.userId || 'System',
            });
          });
  
  
          // Create a resumable that when triggered, calls this same node again, hopefully with resumableId and resumableResult
          await this.workflowExecutionsService.createResumable(
            c,
            {
              ...args,
              event: args.sourceEvent,
              localResult: { id: ID, attempt },
              nextNodes: [nodeData],
              globalResult: r,
              nodeId: nodeData.id,
            },
            new TriggerBuilder(ID)
              .matchMessage('Proof of life submitted')
              .matchCategory('user')
              .matchLevel('info')
              .matchMetadata(['metadata', 'id'], ID)
          );
  
          const localResult = { url: `https://${domain}.${env.DOMAIN}/proof-of-life/${uuid}/run`, id: ID };
  
          // Emit the public URL event first
          return await this.workflowExecutionsService.nextOrEndExecution(c, {
            nodeId: nodeData.id,
            event: WORKFLOW_EVENTS.proofOfLife.publicUrl,
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
          return this.formsService.createFormWithAnswers(
            {
              name: 'Proof of Life',
              description: '',
              createdBy: this.user?.userId || 'System',
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
          return this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: nodeData.id, event: WORKFLOW_EVENTS.proofOfLife.success, executionId, globalResult: r, localResult: { form_id: form.id, instance_id: instance.id, answers_id: answer.id }, workflowId, domain, token });
        }
  
        if (maxAttempts <= attempt) {
          return this.workflowExecutionsService.nextOrEndExecution(c, { nodeId: nodeData.id, event: WORKFLOW_EVENTS.proofOfLife.failure, executionId, globalResult: r, localResult: { form_id: form.id, instance_id: instance.id, answers_id: answer.id }, workflowId, domain, token });
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
  
        return await client.executeNode({ executionId, nodeData, workflowId, yaml: newYaml, domain, token, result: r, sourceEvent: WORKFLOW_EVENTS.proofOfLife.reAttemptUrl }) || {};
      },
  
      fetchProofOfLifeConfig: async (c: ObjectContext, uuid: string) => {
        assert(!!this.user, 'user is required');
        assert(!!this.tenant, 'tenant is required');
  
        const ID = `proof-of-life/${uuid}`;
  
        const keyValue = await this.keyValueService.findById(ID);
  
        if (!keyValue) {
          throw new Error('Key value not found');
        }
  
        const { value } = keyValue;
  
        return JSON.parse(value) as ProofOfLifeNodeConfig & { attempt: number };
      },
  
      submitProofOfLife: async (c: ObjectContext, params: { uuid: string; location: { lat: number; lng: number; }; ip: string; confidence: number, deviceInfo: object }) => {
        assert(!!this.user, 'user is required');
        assert(!!this.tenant, 'tenant is required');
  
        const { uuid, location, ip, confidence, deviceInfo } = params;
        await this.logsService.info('Proof of life submitted', {
          category: 'user',
          metadata: {
            id: `proof-of-life/${uuid}`,
            uuid,
            location,
            ip,
            confidence,
            deviceInfo,
          }
        })
      },
    }
  });

  constructor(
    @Inject(LogsService) private logsService: LogsService,
    @Inject(KeyValueService) private keyValueService: KeyValueService,
    @Inject(FormsService) private formsService: FormsService,
    @Inject(WorkflowExecutionsService) private workflowExecutionsService: WorkflowExecutionsService,
    @Inject(USER) private user: User,
    @Inject(TENANT) private tenant: Tenant,
  ) {
    super();
  }
}
  