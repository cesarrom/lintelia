'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ViewerProps } from '../../schemas';
import { UrlConfig } from './schema';

export function UrlViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
}: ViewerProps<UrlConfig, string>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <div className="flex">
        {config.prefix && (
          <div className="flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">
            {config.prefix}
          </div>
        )}
        <Input
          id={id}
          name={config.propertyName}
          type="url"
          value={value || ''}
          onChange={(e) => {
            const url = e.target.value;
            // If there's a prefix and the user is typing a URL with the same prefix, remove it
            if (config.prefix && url.startsWith(config.prefix)) {
              onChange?.(url.slice(config.prefix.length));
            } else {
              onChange?.(url);
            }
          }}
          onBlur={onBlur}
          placeholder={config.placeholder}
          className={cn(
            error ? 'border-destructive' : undefined,
            config.prefix && 'rounded-l-none'
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
} 