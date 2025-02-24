import * as cheerio from 'cheerio';
import { events, DecisionTableNodeDataSchema, DecisionTableNodeData } from "../types";
import * as restate from "@restatedev/restate-sdk/fetch";
import { nextOrEndExecution, getConfiguration } from "@/lib/restate-utils";
import { NodeData } from "../../(workflows)/(components)/yaml/types";
import { ExecuteNodeFunctionProps } from '../../(workflows)/types';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { decisionTable } = require('@hbtgmbh/dmn-eval-js');

/**
 * Filters XML string by removing disallowed nodes.
 *
 * @param {string} xml - The XML string to be filtered.
 * @param {string[]} allowedNodes - An array of node names that should be retained.
 * @returns {string} - The resulting XML string with only allowed nodes.
 */
function filterXmlNodes(xml: string, allowedNodes: string[]) {
  // Load the XML with xmlMode enabled
  const $ = cheerio.load(xml, { xmlMode: true });

  // Select the <definitions> node
  const definitions = $('definitions');

  // Remove all direct children that are not in the allowedNodes list
  definitions.children().each((index, element) => {
    if (!allowedNodes.includes(element.tagName)) {
      $(element).remove();
    }
  });

  // a node with <decision name=risk ></decision>
  const riskNode = definitions.find('decision[name=risk]');
  const riskId = riskNode.attr('id');

  // Return the resulting XML string
  return { xml: $.xml().replace(/<(\/)?(\w+)/g, '<$1dmn:$2'), riskId: riskId };
}

async function evaluateDecisionTable({ xml, targetDmnId: riskId, outputName }: DecisionTableNodeData, context: Record<string, unknown>) {
  const xmlContent = filterXmlNodes(xml, ['decision', 'inputData', 'input', 'output']);

  const decisions = await decisionTable.parseDmnXml(xmlContent);

  const output = decisionTable.evaluateDecision(riskId, decisions, context);

  const result = output[outputName];

  if (!result) {
    throw new Error("Failed to evaluate dmn");
  }

  return result;
}

export const decisionTableService = restate.object({
  name: "decisionTable",
  handlers: {
    executeNode: async (c: restate.ObjectContext, { executionId, nodeData, yaml, domain, token, result: r }: ExecuteNodeFunctionProps) => {
      const config = await c.run('validate-config', async () => {
        return DecisionTableNodeDataSchema.parse(nodeData.config || {});
      });

      const variables = await getConfiguration(c, executionId, config, r) as DecisionTableNodeData;

      const result = await evaluateDecisionTable(variables, variables.ctx);

      const eventName = events.success;

      return nextOrEndExecution(c, { nodeData, event: eventName, executionId, localResult: result, globalResult: r, yaml, domain, token });
    }
  },
});

export type DecisionTableService = typeof decisionTableService;