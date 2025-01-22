'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';

interface ImageConfig {
  maxSize: number; // in MB
  allowedTypes: string[];
  aspectRatio?: number;
  maxWidth: number;
  maxHeight: number;
  showPreview: boolean;
  previewSize: 'sm' | 'md' | 'lg';
  resizeMode: 'cover' | 'contain' | 'fill';
  defaultImage?: string;
}

const defaultConfig: ImageConfig = {
  maxSize: 5,
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
  maxWidth: 1920,
  maxHeight: 1080,
  showPreview: true,
  previewSize: 'md',
  resizeMode: 'cover'
};

export function ImageProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const config = field.config ? { ...defaultConfig, ...field.config as Partial<ImageConfig> } : defaultConfig;

  const updateConfig = (updates: Partial<ImageConfig>) => {
    onChange({ ...field, config: { ...config, ...updates } });
  };

  const addAllowedType = () => {
    updateConfig({
      allowedTypes: [...config.allowedTypes, '']
    });
  };

  const removeAllowedType = (index: number) => {
    const newTypes = [...config.allowedTypes];
    newTypes.splice(index, 1);
    updateConfig({ allowedTypes: newTypes });
  };

  const updateAllowedType = (index: number, value: string) => {
    const newTypes = [...config.allowedTypes];
    newTypes[index] = value;
    updateConfig({ allowedTypes: newTypes });
  };

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* Image-specific properties */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="maxSize">Max File Size (MB)</Label>
          <Input
            id="maxSize"
            type="number"
            min={1}
            value={config.maxSize}
            onChange={(e) => updateConfig({ maxSize: Number(e.target.value) })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Allowed File Types</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={addAllowedType}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Type
            </Button>
          </div>
          <div className="grid gap-2">
            {config.allowedTypes.map((type, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={type}
                  onChange={(e) => updateAllowedType(i, e.target.value)}
                  placeholder="e.g., image/jpeg"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeAllowedType(i)}
                  className="h-10 w-10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="maxWidth">Max Width (px)</Label>
            <Input
              id="maxWidth"
              type="number"
              min={1}
              value={config.maxWidth}
              onChange={(e) => updateConfig({ maxWidth: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxHeight">Max Height (px)</Label>
            <Input
              id="maxHeight"
              type="number"
              min={1}
              value={config.maxHeight}
              onChange={(e) => updateConfig({ maxHeight: Number(e.target.value) })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="aspectRatio">Aspect Ratio</Label>
          <Input
            id="aspectRatio"
            type="number"
            step="0.01"
            value={config.aspectRatio || ''}
            onChange={(e) => updateConfig({ aspectRatio: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="e.g., 1.78 for 16:9"
          />
          <p className="text-xs text-muted-foreground">
            Leave empty for no aspect ratio constraint
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="showPreview">Show Preview</Label>
            <Switch
              id="showPreview"
              checked={config.showPreview}
              onCheckedChange={(checked) => updateConfig({ showPreview: checked })}
            />
          </div>

          {config.showPreview && (
            <>
              <div className="space-y-2">
                <Label>Preview Size</Label>
                <Select
                  value={config.previewSize}
                  onValueChange={(value: 'sm' | 'md' | 'lg') =>
                    updateConfig({ previewSize: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sm">Small</SelectItem>
                    <SelectItem value="md">Medium</SelectItem>
                    <SelectItem value="lg">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Resize Mode</Label>
                <Select
                  value={config.resizeMode}
                  onValueChange={(value: 'cover' | 'contain' | 'fill') =>
                    updateConfig({ resizeMode: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">Cover</SelectItem>
                    <SelectItem value="contain">Contain</SelectItem>
                    <SelectItem value="fill">Fill</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultImage">Default Image URL</Label>
          <Input
            id="defaultImage"
            type="url"
            value={config.defaultImage || ''}
            onChange={(e) => updateConfig({ defaultImage: e.target.value || undefined })}
            placeholder="https://example.com/image.jpg"
          />
        </div>
      </div>
    </div>
  );
} 