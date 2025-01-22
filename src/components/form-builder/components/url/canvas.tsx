'use client';

import { Link, ExternalLink } from 'lucide-react';
import { FormComponentProps } from '../../types';
import { FieldWrapper } from '../field-wrapper';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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

export function UrlCanvas({ field, onSelect, isSelected }: FormComponentProps) {
  const config = field.config ? { ...defaultConfig, ...field.config as Partial<UrlConfig> } : defaultConfig;
  const value = field.defaultValue as string || '';

  return (
    <FieldWrapper
      field={field}
      icon={Link}
      onSelect={onSelect}
      isSelected={isSelected}
    >
      <div className="space-y-2">
        <div className="flex">
          {config.showPrefix && (
            <div className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted text-muted-foreground text-sm">
              {config.prefix}
            </div>
          )}
          <Input
            type="url"
            placeholder={field.placeholder || 'Enter URL'}
            value={value}
            readOnly
            className={cn(
              config.showPrefix ? 'rounded-l-none' : 'rounded-md',
              'flex-1'
            )}
          />
        </div>
        {config.showLinkPreview && value && (
          <a
            href={value.startsWith('http') ? value : `${config.prefix}${value}`}
            target={config.openInNewTab ? '_blank' : '_self'}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
          >
            <ExternalLink className="h-3 w-3" />
            Preview Link
          </a>
        )}
      </div>
    </FieldWrapper>
  );
} 