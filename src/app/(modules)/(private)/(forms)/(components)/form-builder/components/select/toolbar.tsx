'use client';

import { List } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

export function SelectToolbar() {
  return (
    <ToolbarButton
      type="select"
      label="Select"
      icon={List}
    />
  );
} 