const { decisionTable, dateTime } = require('@hbtgmbh/dmn-eval-js');
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const cheerio = require('cheerio');

if (args.length === 0) {
  console.log('Please provide an argument.');
  process.exit(1);
}

const [xmlPath, decisionId, inputName, dataType, inputValue] = args;

let inputValueParsed;

switch (dataType) {
  case 'date':
    inputValueParsed = new Date(inputValue);
    break;
  case 'dateTime':
    inputValueParsed = new Date(inputValue);
    break;
  case 'time':
    inputValueParsed = new Date(inputValue);
    break;
  case 'boolean':
    inputValueParsed = inputValue === 'true';
    break;
  case 'float':
    inputValueParsed = parseFloat(inputValue);
    break;
  case 'integer':
    inputValueParsed = parseInt(inputValue);
    break;
  case 'number':
    inputValueParsed = Number(inputValue);
    break;
  case 'string':
    inputValueParsed = inputValue;
    break;
  default:
    console.log('Invalid data type.');
    process.exit(1);
}

const xml = fs.readFileSync(
  path.join(process.cwd(), xmlPath)
  , 'utf8');

/**
 * Filters XML string by removing disallowed nodes.
 *
 * @param {string} xml - The XML string to be filtered.
 * @param {string[]} allowedNodes - An array of node names that should be retained.
 * @returns {string} - The resulting XML string with only allowed nodes.
 */
function filterXmlNodes(xml, allowedNodes) {
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

  // Return the resulting XML string
  return $.xml();
}

const filteredXml = filterXmlNodes(xml, ['decision', 'inputData', 'input', 'output']);


decisionTable.parseDmnXml(filteredXml)
  .then((decisions) => {
    // DMN was successfully parsed
    const context = {
      [inputName]: inputValueParsed
    };

    try {
      const data = decisionTable.evaluateDecision(decisionId, decisions, context);
      // data is the output of the decision execution
      // it is an array for hit policy COLLECT and RULE ORDER, and an object else
      // it is undefined if no rule matched

      console.log(data);

    } catch (err) {
      // failed to evaluate rule, maybe the context is missing some data?
      console.log(err)
    };
  })
  .catch(err => {
    // failed to parse DMN XML: either invalid XML or valid XML but invalid DMN
    console.log(err)
  });