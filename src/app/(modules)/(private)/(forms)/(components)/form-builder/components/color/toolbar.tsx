'use client';

import { Palette } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

export function ColorToolbar() {
  return (
    <ToolbarButton
      type="color"
      label="Color Picker"
      icon={Palette}
    />
  );
} 