'use client';

import { Columns } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

export function ColumnsToolbar() {
  return (
    <ToolbarButton
      type="columns"
      label="Columns"
      icon={Columns}
      defaultConfig={{
        count: 2,
        widths: ['1fr', '1fr'],
        gap: 4
      }}
    />
  );
} 