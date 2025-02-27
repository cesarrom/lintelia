'use client';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ViewerProps } from '../../schemas';
import { richtextConfigSchema } from './schema';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import { z } from 'zod';

export function RichtextViewer({
  id,
  config,
  value,
  error,
}: ViewerProps<z.infer<typeof richtextConfigSchema>, string>) {
  // Function to interpolate variables in content
  const interpolateContent = (content: string, variables: Record<string, unknown> = {}, formValues: Record<string, unknown> = {}) => {
    let interpolatedContent = content;

    // Replace variable references
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      interpolatedContent = interpolatedContent.replace(regex, String(value));
    });

    // Replace form field references
    Object.entries(formValues).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g');
      interpolatedContent = interpolatedContent.replace(regex, String(value));
    });

    return interpolatedContent;
  };

  const editor = useEditor({
    extensions: [StarterKit],
    content: value || config.content || '',
    editable: false,
  });

  // Update editor content when value changes
  useEffect(() => {
    if (editor && (value || config.content)) {
      editor.commands.setContent(value || config.content || '');
    }
  }, [editor, value, config.content]);

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
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div dangerouslySetInnerHTML={{ __html: value || config.content || '' }} />
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 