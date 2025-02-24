'use client';

import { Radio as RadioIcon } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

export function RadioToolbar() {
  return (
    <ToolbarButton
      type="radio"
      label="Radio Group"
      icon={RadioIcon}
    />
  );
} 