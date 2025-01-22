'use client';

import { SeparatorHorizontal } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

export function SeparatorToolbar() {
  return (
    <ToolbarButton
      type="separator"
      label="Page Separator"
      icon={SeparatorHorizontal}
      defaultConfig={{
        showLabel: true,
        labelPosition: 'center',
        thickness: 1,
        style: 'solid'
      }}
    />
  );
} 