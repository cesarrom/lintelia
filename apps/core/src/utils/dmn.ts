import * as cheerio from 'cheerio';
// const { decisionTable } = require('@hbtgmbh/dmn-eval-js');

/**
 * Filters XML string by removing disallowed nodes.
 *
 * @param {string} xml - The XML string to be filtered.
 * @param {string[]} allowedNodes - An array of node names that should be retained.
 * @returns {string} - The resulting XML string with only allowed nodes.
 */
function filterXmlNodes(xml: string, allowedNodes: string[]) {
  // Load the XML with xmlMode enabled
  const $ = cheerio.load(xml, { xml: true });

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

export async function parseDMN(xml: string) {
  const xmlContent = filterXmlNodes(xml, ['decision', 'inputData', 'input', 'output']);

  // const decisions = await decisionTable.parseDmnXml(xmlContent);

  return {} as any
}