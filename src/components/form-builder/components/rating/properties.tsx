'use client';

import { FormComponentProps } from '../../types';
import { BaseProperties } from '../base-properties';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';

interface RatingConfig {
  maxRating: number;
  showLabels: boolean;
  labels: string[];
  icon: 'star' | 'heart' | 'thumbsUp';
  size: 'sm' | 'md' | 'lg';
  showValue: boolean;
}

const defaultConfig: RatingConfig = {
  maxRating: 5,
  showLabels: true,
  labels: ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'],
  icon: 'star',
  size: 'md',
  showValue: true
};

export function RatingProperties({ field, onChange }: FormComponentProps) {
  if (!onChange) return null;

  const config = field.config ? { ...defaultConfig, ...field.config as Partial<RatingConfig> } : defaultConfig;

  const updateConfig = (updates: Partial<RatingConfig>) => {
    onChange({ ...field, config: { ...config, ...updates } });
  };

  const updateLabel = (index: number, value: string) => {
    const newLabels = [...config.labels];
    newLabels[index] = value;
    updateConfig({ labels: newLabels });
  };

  return (
    <div className="space-y-4">
      <BaseProperties field={field} onChange={onChange} />

      {/* Rating-specific properties */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Number of Stars</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => updateConfig({ maxRating: Math.max(1, config.maxRating - 1) })}
              disabled={config.maxRating <= 1}
              className="h-8 w-8"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-4 text-center">{config.maxRating}</span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => updateConfig({ maxRating: Math.min(10, config.maxRating + 1) })}
              disabled={config.maxRating >= 10}
              className="h-8 w-8"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Icon Style</Label>
          <Select
            value={config.icon}
            onValueChange={(value: 'star' | 'heart' | 'thumbsUp') =>
              updateConfig({ icon: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select icon" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="star">Star</SelectItem>
              <SelectItem value="heart">Heart</SelectItem>
              <SelectItem value="thumbsUp">Thumbs Up</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Icon Size</Label>
          <Select
            value={config.size}
            onValueChange={(value: 'sm' | 'md' | 'lg') =>
              updateConfig({ size: value })
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

        <div className="flex items-center justify-between">
          <Label htmlFor="showValue">Show Value</Label>
          <Switch
            id="showValue"
            checked={config.showValue}
            onCheckedChange={(checked) => updateConfig({ showValue: checked })}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="showLabels">Show Labels</Label>
            <Switch
              id="showLabels"
              checked={config.showLabels}
              onCheckedChange={(checked) => updateConfig({ showLabels: checked })}
            />
          </div>

          {config.showLabels && (
            <div className="space-y-2">
              <Label>Rating Labels</Label>
              <div className="grid gap-2">
                {config.labels.slice(0, config.maxRating).map((label, i) => (
                  <Input
                    key={i}
                    value={label}
                    onChange={(e) => updateLabel(i, e.target.value)}
                    placeholder={`Label for ${i + 1} stars`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 