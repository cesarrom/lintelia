'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Plus, Minus, X } from 'lucide-react';

interface UrlConfig {
  prefix: string;
  showPrefix: boolean;
  validateUrl: boolean;
  allowedProtocols: string[];
  openInNewTab: boolean;
  showLinkPreview: boolean;
}

const defaultConfig: UrlConfig = {
  prefix: 'https://',
  showPrefix: true,
  validateUrl: true,
  allowedProtocols: ['http://', 'https://'],
  openInNewTab: true,
  showLinkPreview: true
};

export function UrlProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const config = field.config ? { ...defaultConfig, ...field.config as Partial<UrlConfig> } : defaultConfig;

  const updateConfig = (updates: Partial<UrlConfig>) => {
    onChange({ ...field, config: { ...config, ...updates } });
  };

  const addProtocol = () => {
    updateConfig({
      allowedProtocols: [...config.allowedProtocols, '']
    });
  };

  const removeProtocol = (index: number) => {
    const newProtocols = [...config.allowedProtocols];
    newProtocols.splice(index, 1);
    updateConfig({ allowedProtocols: newProtocols });
  };

  const updateProtocol = (index: number, value: string) => {
    const newProtocols = [...config.allowedProtocols];
    newProtocols[index] = value;
    updateConfig({ allowedProtocols: newProtocols });
  };

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* URL-specific properties */}
      <div className="space-y-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="showPrefix">Show Protocol Prefix</Label>
            <Switch
              id="showPrefix"
              checked={config.showPrefix}
              onCheckedChange={(checked) => updateConfig({ showPrefix: checked })}
            />
          </div>

          {config.showPrefix && (
            <div className="space-y-2">
              <Label htmlFor="prefix">Default Protocol</Label>
              <Input
                id="prefix"
                value={config.prefix}
                onChange={(e) => updateConfig({ prefix: e.target.value })}
                placeholder="https://"
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="validateUrl">Validate URL</Label>
            <Switch
              id="validateUrl"
              checked={config.validateUrl}
              onCheckedChange={(checked) => updateConfig({ validateUrl: checked })}
            />
          </div>

          {config.validateUrl && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Allowed Protocols</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addProtocol}
                  className="h-8"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Protocol
                </Button>
              </div>
              <div className="grid gap-2">
                {config.allowedProtocols.map((protocol, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={protocol}
                      onChange={(e) => updateProtocol(i, e.target.value)}
                      placeholder="e.g., https://"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeProtocol(i)}
                      className="h-10 w-10"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="openInNewTab">Open in New Tab</Label>
          <Switch
            id="openInNewTab"
            checked={config.openInNewTab}
            onCheckedChange={(checked) => updateConfig({ openInNewTab: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="showLinkPreview">Show Link Preview</Label>
          <Switch
            id="showLinkPreview"
            checked={config.showLinkPreview}
            onCheckedChange={(checked) => updateConfig({ showLinkPreview: checked })}
          />
        </div>
      </div>
    </div>
  );
} 