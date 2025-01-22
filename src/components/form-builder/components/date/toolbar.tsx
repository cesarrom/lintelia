'use client';

import { Calendar } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

export function DateToolbar() {
  return (
    <ToolbarButton
      type="date"
      label="Date Picker"
      icon={Calendar}
    />
  );
} 