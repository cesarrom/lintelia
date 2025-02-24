'use client';

import { FileUp } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

export function FileToolbar() {
  return (
    <ToolbarButton
      type="file"
      label="File Upload"
      icon={FileUp}
    />
  );
} 