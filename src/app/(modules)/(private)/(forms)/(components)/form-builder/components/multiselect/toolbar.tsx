'use client';

import { ListChecks } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

export function MultiselectToolbar() {
  return (
    <ToolbarButton
      type="multiselect"
      label="Multi Select"
      icon={ListChecks}
    />
  );
} 