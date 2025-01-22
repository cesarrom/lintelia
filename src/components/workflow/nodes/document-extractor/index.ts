import { FileSearch } from 'lucide-react';
import { DocumentExtractorNode } from './DocumentExtractorNode';
import { DocumentExtractorToolbar } from './DocumentExtractorToolbar';
import { NodeDefinition } from '../types';

export const documentExtractorNode: NodeDefinition = {
  get id() {
    return crypto.randomUUID();
  },
  type: 'documentExtractor',
  name: 'Document Extractor',
  description: 'Extract data from documents using OCR and other methods',
  icon: FileSearch,
  node: DocumentExtractorNode,
  toolbar: DocumentExtractorToolbar,
  inputs: [],
  events: [],
}; 