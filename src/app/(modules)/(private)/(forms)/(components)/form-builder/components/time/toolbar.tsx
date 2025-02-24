'use client';

import { Clock } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

export function TimeToolbar() {
  return (
    <ToolbarButton
      type="time"
      label="Time Picker"
      icon={Clock}
    />
  );
} 