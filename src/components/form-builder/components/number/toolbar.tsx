'use client';

import { Hash } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

export function NumberToolbar() {
  return (
    <ToolbarButton
      type="number"
      label="Number"
      icon={Hash}
    />
  );
} 