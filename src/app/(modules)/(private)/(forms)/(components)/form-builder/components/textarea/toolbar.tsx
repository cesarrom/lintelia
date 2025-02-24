'use client';

import { AlignLeft } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

export function TextareaToolbar() {
  return (
    <ToolbarButton
      type="textarea"
      label="Text Area"
      icon={AlignLeft}
    />
  );
} 