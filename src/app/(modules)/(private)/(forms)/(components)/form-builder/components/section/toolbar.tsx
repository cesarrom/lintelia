'use client';

import { LayoutGrid } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

export function SectionToolbar() {
  return (
    <ToolbarButton
      type="section"
      label="Section"
      icon={LayoutGrid}
    />
  );
} 