'use client';

import { CheckSquare } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

export function CheckboxToolbar() {
  return (
    <ToolbarButton
      type="checkbox"
      label="Checkbox"
      icon={CheckSquare}
    />
  );
} 