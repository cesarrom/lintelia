'use client';

import { SplitSquareHorizontal } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

interface PageSeparatorConfig {
  title: string;
  description?: string;
  showBackButton: boolean;
  showNextButton: boolean;
  backButtonText: string;
  nextButtonText: string;
}

const defaultConfig: PageSeparatorConfig = {
  title: 'Page 2',
  description: 'Continue to the next page',
  showBackButton: true,
  showNextButton: true,
  backButtonText: 'Previous',
  nextButtonText: 'Next'
};

export function PageSeparatorToolbar() {
  return (
    <ToolbarButton
      type="page-separator"
      label="Page Break"
      icon={SplitSquareHorizontal}
      config={defaultConfig}
    />
  );
} 