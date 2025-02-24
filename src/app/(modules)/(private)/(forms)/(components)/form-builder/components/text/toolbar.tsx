'use client';

import { Type } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

export function TextToolbar() {
  return (
    <ToolbarButton
      type="text"
      label="Text"
      icon={Type}
    />
  );
} 