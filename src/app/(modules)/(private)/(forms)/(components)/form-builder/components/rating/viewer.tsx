'use client';

import { Star } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../schemas';
import { RatingConfig } from './schema';
import { cn } from '@/lib/utils';
import { useController, ControllerFieldState } from 'react-hook-form';

export function RatingViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  register,
  formState,
  control
}: ViewerProps<RatingConfig, number>) {
  // Check if we're using react-hook-form
  const isUsingReactHookForm = !!register && !!formState && !!control;
  
  // Use controller for react-hook-form if available
  const controllerResult = isUsingReactHookForm 
    ? useController({
        name: config.propertyName,
        control,
        defaultValue: value,
        rules: {
          required: config.required ? 'This field is required' : false,
          min: { value: 1, message: 'Please select a rating' },
          max: { value: config.maxRating, message: `Maximum rating is ${config.maxRating}` }
        }
      })
    : null;

  // Get error message from react-hook-form or from props
  const errorMessage = isUsingReactHookForm && controllerResult?.fieldState.error
    ? controllerResult.fieldState.error.message 
    : error;

  const rating = isUsingReactHookForm && controllerResult
    ? controllerResult.field.value
    : (value as number | undefined);

  const handleRatingClick = (starValue: number) => {
    if (isUsingReactHookForm && controllerResult) {
      controllerResult.field.onChange(starValue);
      controllerResult.field.onBlur();
    } else {
      onChange?.(starValue);
      onBlur?.();
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block">
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <div className="flex items-center gap-1">
        {Array.from({ length: config.maxRating }).map((_, i) => {
          const starValue = i + 1;
          const isFilled = rating !== undefined && starValue <= rating;

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleRatingClick(starValue)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleRatingClick(starValue);
                }
              }}
              className={cn(
                'focus-visible:ring-ring ring-offset-background rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                errorMessage ? 'text-destructive' : isFilled ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Star className="h-5 w-5" fill={isFilled ? 'currentColor' : 'none'} />
            </button>
          );
        })}
        {config.showLabels && (
          <div className="ml-2 text-sm text-muted-foreground">
            {rating ? (rating === 1 ? config.lowLabel : rating === config.maxRating ? config.highLabel : '') : ''}
          </div>
        )}
      </div>
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </div>
  );
} 