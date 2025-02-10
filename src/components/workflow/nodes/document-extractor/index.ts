import { FileSearch } from 'lucide-react';
import { DocumentExtractorNode } from './DocumentExtractorNode';
import { DocumentExtractorToolbar } from './DocumentExtractorToolbar';
import { NodeDefinition } from '../types';
import { v4 as uuid } from 'uuid';

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
  events: [],
}; 