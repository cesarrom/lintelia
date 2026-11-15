'use client';

import { FileText, Bold, Italic, List, ListOrdered, Heading1, Heading2, Heading3, AlignCenter, AlignRight, AlignJustify, Underline as UnderlineIcon, Code, TextQuote } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { useVariables } from '../../context/variables';
import { Button } from '@/components/ui/button';
import tippy from 'tippy.js';
import { EditorProps } from '../../schemas';
import { useEffect, useState, useMemo } from 'react';
import { FormComponentConfig, RichtextConfig } from '@repo/fintivio/schemas';
import { useTheme } from '@/lib/providers/ThemeProvider';

const systemVars = [
  { id: 'currentDate', label: 'Current Date' },
  { id: 'currentTime', label: 'Current Time' },
  { id: 'currentUser', label: 'Current User' },
  { id: 'formId', label: 'Form ID' },
  { id: 'instanceId', label: 'Instance ID' },
];

interface MentionItem {
  id: string;
  label: string;
  type: 'variable' | 'form' | 'system';
}

export function RichtextEditor({
  id,
  config,
  isSelected,
  onSelect,
  onConfigChange,
  formComponents,
}: EditorProps<RichtextConfig> & {
  formComponents?: FormComponentConfig[];
}) {
  const { variables, definitions } = useVariables();
  const { theme } = useTheme();
  const [formFields, setFormFields] = useState<Array<{ id: string; label: string; propertyName: string }>>([]);

  // Extract form fields from components
  useEffect(() => {
    if (formComponents) {
      const fields = formComponents
        .filter(component => component.id !== id) // Exclude self
        .map(component => {
          const config = component.config as any;
          return {
            id: component.id,
            label: config.label || 'Unnamed Field',
            propertyName: config.propertyName || '',
          };
        })
        .filter(field => field.propertyName); // Only include fields with property names

      setFormFields(fields);
    }
  }, [formComponents, id]);


  // Create a custom mention extension
  const customMention = useMemo(() => Mention.configure({
    HTMLAttributes: {
      class: 'mention',
      'data-type': 'mention',
    },
    renderLabel({ options, node }) {
      return `{{${node.attrs.id}}}`;
    },
    suggestion: {
      char: '{{',
      items: ({ query }: { query: string }): MentionItem[] => {

        const allItems = (query && query.includes('.') ? [
          ...Object.entries(definitions).map(([key, value]) => ({
            id: `vars.${key}`,
            label: value?.name || key,
            type: 'variable' as const
          })),
          ...formFields.map(field => ({
            id: `form.${field.propertyName}`,
            label: `${field.label} (${field.propertyName})`,
            type: 'form' as const
          })),
          ...systemVars.map(sysVar => ({
            id: `system.${sysVar.id}`,
            label: sysVar.label,
            type: 'system' as const
          })),
        ] : [
          { id: 'vars', label: 'Variables ({{vars.}})', type: 'variable' },
          { id: 'form', label: 'Form Fields ({{form.}})', type: 'form' },
          { id: 'system', label: 'System Variables ({{system.}})', type: 'system' },
        ]) as MentionItem[];


        const enabled = {
          variable: config.enableVariables,
          form: config.enableFieldReferences,
          system: config.enableSystemVariables,
        } as const;

        const [prefix, search] = (query || '').split('.') as [string | undefined, string | undefined];

        const filtered = allItems.filter(item => {
          return enabled[item.type] && (!query || (item.type.includes(prefix || '') && (!search || item.label.toLowerCase().includes(search.toLowerCase()) || item.id.toLowerCase().includes(search.toLowerCase()))));
        }).slice(0, 10);

        return filtered;
      },
      render: () => {
        let popup: any = null;
        let component: HTMLDivElement;

        return {
          onStart: (props) => {
            component = document.createElement('div');
            component.classList.add(
              'rounded-md',
              'shadow-md',
              'border',
              'p-1',
              theme === 'dark' ? 'bg-background/95' : 'bg-background',
              'backdrop-blur',
              'supports-[backdrop-filter]:bg-background/60',
              'min-w-[200px]', // Add minimum width
              'z-50' // Ensure high z-index
            );

            popup = tippy(document.body, {
              getReferenceClientRect: () => props?.clientRect?.() || new DOMRect(),
              appendTo: () => document.body,
              content: component,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: 'bottom-start',
              zIndex: 9999, // Ensure high z-index
            });
          },
          onUpdate: (props) => {
            if (!popup || !component) return;

            component.innerHTML = '';

            props.items.forEach((item: MentionItem) => {
              const button = document.createElement('button');
              button.className = cn(
                'block w-full text-left px-2 py-1 rounded',
                theme === 'dark' ? 'hover:bg-muted' : 'hover:bg-gray-100',
                theme === 'dark' ? 'text-foreground' : 'text-gray-900'
              );
              button.textContent = item.label;

              button.addEventListener('click', () => {
                // Insert the full variable syntax
                const text = `{{${item.id}}}`;
                props.command({ id: text });
                popup.hide();
              });

              component.appendChild(button);
            });

            popup.setProps({
              getReferenceClientRect: props.clientRect,
            });
          },
          onKeyDown: (props) => {
            if (props.event.key === 'Escape' && popup) {
              popup.hide();
              return true;
            }
            return false;
          },
          onExit: () => {
            if (popup) {
              popup.destroy();
              popup = null;
            }
          },
        };
      },
    },
  }), [Object.entries(definitions).length, formFields.length]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: config.placeholder || '',
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      customMention,
    ],
    content: config.content || '',
    editable: true,
    onUpdate: ({ editor }) => {
      if (onConfigChange) {
        const updatedConfig = { ...config };
        updatedConfig.content = editor.getHTML();
        onConfigChange(updatedConfig);
      }
    },
  }, [customMention]);

  // Add CSS for mentions
  useEffect(() => {
    // Add a style tag for mentions if it doesn't exist
    if (!document.getElementById('mention-styles')) {
      const style = document.createElement('style');
      style.id = 'mention-styles';
      style.innerHTML = `
        .mention {
          background-color: rgba(var(--primary-rgb), 0.2);
          border-radius: 0.25rem;
          padding: 0.125rem 0.25rem;
          font-weight: 500;
          white-space: nowrap;
          color: var(--primary);
        }
        .dark .mention {
          background-color: rgba(var(--primary-rgb), 0.3);
        }
      `;
      document.head.appendChild(style);
    }

    return () => {
      // Clean up on unmount
      const styleTag = document.getElementById('mention-styles');
      if (styleTag) {
        styleTag.remove();
      }
    };
  }, []);

  // Ensure editor is destroyed on unmount
  useEffect(() => {
    return () => {
      if (editor) {
        editor.destroy();
      }
    };
  }, [editor]);

  // Update editor content when config.content changes
  useEffect(() => {
    if (editor && config.content) {
      // Only update if the content is different to avoid cursor position issues
      if (editor.getHTML() !== config.content) {
        editor.commands.setContent(config.content);
      }
    }
  }, [editor, config.content]);

  return (
    <div
      className={cn(
        'relative rounded-lg border p-4 transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={() => onSelect?.()}
    >
      <div className="absolute left-2 top-2 text-muted-foreground">
        <FileText className="h-4 w-4" />
      </div>
      <div className="mb-2 pl-6">
        <Label>{config.label}</Label>
        {config.description && (
          <p className="text-sm text-muted-foreground">{config.description}</p>
        )}
      </div>
      <div className="prose prose-sm max-w-none" onClick={() => editor?.commands.focus()}>
        <div className="flex flex-wrap items-center gap-1 rounded-md border bg-background p-1 shadow-md">
          {/* Text Style Controls */}
          <div className="flex items-center gap-1 border-r pr-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor?.isActive('bold') && 'bg-muted')}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor?.isActive('italic') && 'bg-muted')}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor?.isActive('underline') && 'bg-muted')}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            >
              <UnderlineIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor?.isActive('code') && 'bg-muted')}
              onClick={() => editor?.chain().focus().toggleCode().run()}
            >
              <Code className="h-4 w-4" />
            </Button>
          </div>

          {/* Heading Controls */}
          <div className="flex items-center gap-1 border-r pr-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor?.isActive('heading', { level: 1 }) && 'bg-muted')}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor?.isActive('heading', { level: 2 }) && 'bg-muted')}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor?.isActive('heading', { level: 3 }) && 'bg-muted')}
              onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              <Heading3 className="h-4 w-4" />
            </Button>
          </div>

          {/* List Controls */}
          <div className="flex items-center gap-1 border-r pr-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor?.isActive('bulletList') && 'bg-muted')}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor?.isActive('orderedList') && 'bg-muted')}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor?.isActive('blockquote') && 'bg-muted')}
              onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            >
              <TextQuote className="h-4 w-4" />
            </Button>
          </div>

          {/* Alignment Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor?.isActive({ textAlign: 'left' }) && 'bg-muted')}
              onClick={() => editor?.chain().focus().setTextAlign('left').run()}
            >
              <AlignJustify className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor?.isActive({ textAlign: 'center' }) && 'bg-muted')}
              onClick={() => editor?.chain().focus().setTextAlign('center').run()}
            >
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor?.isActive({ textAlign: 'right' }) && 'bg-muted')}
              onClick={() => editor?.chain().focus().setTextAlign('right').run()}
            >
              <AlignRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-2 min-h-[150px] rounded-md border p-3">
          {editor && (
            <EditorContent editor={editor} />
          )}
        </div>
      </div>
    </div>
  );
}