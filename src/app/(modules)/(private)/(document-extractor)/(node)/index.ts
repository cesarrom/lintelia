import { FileSearch } from 'lucide-react';
import { DocumentExtractorNode } from './DocumentExtractorNode';
import { DocumentExtractorToolbar } from './DocumentExtractorToolbar';
import { v4 as uuid } from 'uuid';
import { NodeDefinition } from '../../(workflows)/(components)/nodes/types';

export const documentExtractorNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  type: 'documentExtractor',
  name: 'Document Extractor',
  description: 'Extract data from documents using OCR and other methods',
  icon: FileSearch,
  node: DocumentExtractorNode,
  toolbar: DocumentExtractorToolbar,
  events: [
    {
      name: 'public_url',
      outputs: [
        {
          name: 'url',
          type: 'string',
        }
      ],
    },
    {
      name: 'extracted',
      outputs: [
        {
          name: 'documentNumber',
          type: 'string'
        },
        {
          name: 'documentCountryIso',
          type: 'string'
        },
        {
          name: 'documentCountryIso3',
          type: 'string'
        },
        {
          name: 'nationalityIso',
          type: 'string'
        },
        {
          name: 'nationalityIso3',
          type: 'string'
        },
        {
          name: 'firstName',
          type: 'string'
        },
        {
          name: 'lastName',
          type: 'string'
        },
        {
          name: 'sex',
          type: 'string'
        },
        {
          name: 'type',
          type: 'string'
        },
        {
          name: 'expirationMonth',
          type: 'string'
        },
        {
          name: 'expirationYear',
          type: 'string'
        },
        {
          name: 'expirationDate',
          type: 'string'
        }
      ],
    }
  ],
}; 