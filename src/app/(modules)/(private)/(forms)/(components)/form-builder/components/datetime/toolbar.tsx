'use client';

import { CalendarClock } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

export function DateTimeToolbar() {
  return (
    <ToolbarButton
      type="datetime"
      label="Date & Time"
      icon={CalendarClock}
      defaultConfig={{
        showDate: true,
        showTime: true,
        format: 'yyyy-MM-dd HH:mm:ss'
      }}
    />
  );
} 