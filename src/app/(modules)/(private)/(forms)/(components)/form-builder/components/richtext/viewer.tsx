'use client';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ViewerProps } from '../../schemas';
import { RichtextConfig } from './schema';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useMemo } from 'react';
import { useVariables } from '../../context/variables';
import Mustache from 'mustache';

export function RichtextViewer({
  id,
  config,
  value,
  error,
  formValues,
}: ViewerProps<RichtextConfig, string> & {
  formValues?: Record<string, unknown>;
}) {
  const { variables } = useVariables();
  
  // Function to interpolate variables in content
  const interpolateContent = (content: string): string => {
    if (!content) return '';
    
    let interpolatedContent = content;

    // Replace variable references ({{vars.variableName}})
    if (variables && config.enableVariables) {
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{vars\\.${key}}}`, 'g');
        interpolatedContent = interpolatedContent.replace(regex, String(value ?? ''));
      });
    }

    // Replace form field references ({{form.fieldName}})
    if (formValues && config.enableFieldReferences) {
      Object.entries(formValues).forEach(([key, value]) => {
        const regex = new RegExp(`{{form\\.${key}}}`, 'g');
        interpolatedContent = interpolatedContent.replace(regex, String(value ?? ''));
      });
    }

    // Replace system variables ({{system.variableName}})
    if (config.enableSystemVariables) {
      const now = new Date();
      const systemVars: Record<string, string> = {
        'currentDate': now.toLocaleDateString(),
        'currentTime': now.toLocaleTimeString(),
        'currentUser': 'Current User', // This would be replaced with actual user info
        'formId': 'Form ID', // This would be replaced with actual form ID
        'instanceId': 'Instance ID', // This would be replaced with actual instance ID
      };
      
      Object.entries(systemVars).forEach(([key, value]) => {
        const regex = new RegExp(`{{system\\.${key}}}`, 'g');
        interpolatedContent = interpolatedContent.replace(regex, value);
      });
    }

    return interpolatedContent;
  };

  // Memoize the interpolated content to avoid unnecessary re-renders
  const interpolatedContent = useMemo(() => {
    return interpolateContent(value || config.content || '');
  }, [value, config.content, variables, formValues]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: interpolatedContent,
    editable: false,
  });

  // Update editor content when interpolated content changes
  useEffect(() => {
    if (editor) {
      editor.commands.setContent(interpolatedContent);
    }
  }, [editor, interpolatedContent]);

  // Ensure editor is destroyed on unmount
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);

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
          <div dangerouslySetInnerHTML={{ __html: interpolatedContent }} />
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
} 