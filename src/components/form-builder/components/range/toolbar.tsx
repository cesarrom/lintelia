'use client';

import { SlidersHorizontal } from 'lucide-react';
import { ToolbarButton } from '../toolbar-button';

interface RangeConfig {
  min: number;
  max: number;
  step: number;
  showValue: boolean;
  showLimits: boolean;
  showTicks: boolean;
  tickCount: number;
}

const defaultConfig: RangeConfig = {
  min: 0,
  max: 100,
  step: 1,
  showValue: true,
  showLimits: true,
  showTicks: false,
  tickCount: 5
};

export function RangeToolbar() {
  return (
    <ToolbarButton
      type="range"
      label="Range Slider"
      icon={SlidersHorizontal}
      config={defaultConfig}
    />
  );
} 