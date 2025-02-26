'use client';

import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { ViewerProps } from '../../types';
import { richtextConfigSchema, richtextInputSchema, richtextOutputSchema } from './schema';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useVariables } from '../../context/variables';
import { get } from 'lodash';

export function RichtextViewer({
  id,
  config,
  value,
  onChange,
  onBlur,
  error,
  formValues,
}: ViewerProps<typeof richtextConfigSchema, typeof richtextInputSchema, typeof richtextOutputSchema>) {
  const { variables } = useVariables();

  // Function to interpolate variables in content
  const interpolateContent = (content: string) => {
    let interpolatedContent = content;

    // Replace variable references
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      interpolatedContent = interpolatedContent.replace(regex, String(value));
    });

    // Replace form field references
    if (formValues) {
      Object.entries(formValues).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g');
        interpolatedContent = interpolatedContent.replace(regex, String(value));
      });
    }

    return interpolatedContent;
  };

  const editor = useEditor({
    extensions: [StarterKit],
    content: value ? interpolateContent(value) : config.content,
    editable: false,
  });

  const handleChange = (newValue: string) => {
    if (onChange) {
      onChange(newValue);
      if (onBlur) onBlur();
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {config.label}
        {config.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {config.description && (
        <p className="text-sm text-muted-foreground">{config.description}</p>
      )}
      <div className="prose prose-sm max-w-none rounded-md border bg-muted/50 p-4">
        <EditorContent editor={editor} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 