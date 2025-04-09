import { v4 as uuid } from 'uuid';
import { DocumentExtractorNode } from './DocumentExtractorNode';
import { DocumentExtractorToolbar } from './DocumentExtractorToolbar';
import { NodeDefinition } from '../../types';
import { FileSearch } from 'lucide-react';

export const documentExtractorNode: NodeDefinition = {
  get id() {
    return uuid();
  },
  toolbar: DocumentExtractorToolbar,
  node: DocumentExtractorNode,
  icon: FileSearch,
  type: 'documentExtractor',
  name: 'Document Extractor',
  description: 'Extract data from documents using OCR and other methods',
  events: [
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
        },
        {
          name: 'form_id',
          type: 'string',
        },
        {
          name: 'instance_id',
          type: 'string',
        },
        {
          name: 'answers_id',
          type: 'string',
        },
      ],
    }
  ],
};