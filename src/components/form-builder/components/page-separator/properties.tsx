'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

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

export function PageSeparatorProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const config = field.config ? { ...defaultConfig, ...field.config as Partial<PageSeparatorConfig> } : defaultConfig;

  const updateConfig = (updates: Partial<PageSeparatorConfig>) => {
    onChange({ ...field, config: { ...config, ...updates } });
  };

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* Page Separator specific properties */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Page Title</Label>
          <Input
            id="title"
            value={config.title}
            onChange={(e) => updateConfig({ title: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={config.description}
            onChange={(e) => updateConfig({ description: e.target.value })}
            placeholder="Optional description text"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="showBackButton">Show Back Button</Label>
            <Switch
              id="showBackButton"
              checked={config.showBackButton}
              onCheckedChange={(checked) => updateConfig({ showBackButton: checked })}
            />
          </div>

          {config.showBackButton && (
            <div className="space-y-2">
              <Label htmlFor="backButtonText">Back Button Text</Label>
              <Input
                id="backButtonText"
                value={config.backButtonText}
                onChange={(e) => updateConfig({ backButtonText: e.target.value })}
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="showNextButton">Show Next Button</Label>
            <Switch
              id="showNextButton"
              checked={config.showNextButton}
              onCheckedChange={(checked) => updateConfig({ showNextButton: checked })}
            />
          </div>

          {config.showNextButton && (
            <div className="space-y-2">
              <Label htmlFor="nextButtonText">Next Button Text</Label>
              <Input
                id="nextButtonText"
                value={config.nextButtonText}
                onChange={(e) => updateConfig({ nextButtonText: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 