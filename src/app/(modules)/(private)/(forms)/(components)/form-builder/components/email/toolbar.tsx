'use client';

import { Mail } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

export function EmailToolbar() {
  return (
    <ToolbarButton
      type="email"
      label="Email"
      icon={Mail}
    />
  );
} 