'use client';

import { FileText, Bold, Italic, List, ListOrdered, Heading1, Heading2, Heading3, AlignCenter, AlignRight, AlignJustify, Underline as UnderlineIcon, Code, TextQuote } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { RichtextConfig, richtextConfigSchema } from './schema';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Mention from '@tiptap/extension-mention';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import { useVariables } from '../../context/variables';
import { Button } from '@/components/ui/button';
import tippy from 'tippy.js';
import { EditorProps } from '../../schemas';
import { z } from 'zod';

interface MentionItem {
  id: string;
  label: string;
  type: 'variable' | 'field';
}

export function RichtextEditor({
  id,
  config,
  isSelected,
  onSelect,
  onConfigChange,
}: EditorProps<z.infer<typeof richtextConfigSchema>>) {
  const { variables, definitions } = useVariables();

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
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
          'data-type': 'variable',
        },
        suggestion: {
          char: '@',
          items: ({ query }: { query: string }): MentionItem[] => {
            const items: MentionItem[] = [];
            
            // Add form variables
            Object.entries(variables).forEach(([key, value]) => {
              if (key.toLowerCase().includes(query.toLowerCase())) {
                items.push({
                  id: key,
                  label: definitions[key]?.name || key,
                  type: 'variable'
                });
              }
            });

            return items.slice(0, 5);
          },
          render: () => {
            let popup: any;
            let component: HTMLDivElement;

            return {
              onStart: (props) => {
                component = document.createElement('div');
                component.classList.add('rounded-md', 'bg-white', 'shadow-md', 'border', 'p-1');
                
                popup = tippy(document.body, {
                  getReferenceClientRect: () => props?.clientRect?.() || new DOMRect(),
                  appendTo: () => document.body,
                  content: component,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },
              onUpdate: (props) => {
                component.innerHTML = '';
                
                props.items.forEach((item: MentionItem) => {
                  const button = document.createElement('button');
                  button.className = 'block w-full text-left px-2 py-1 hover:bg-gray-100 rounded';
                  button.textContent = item.label;
                  
                  button.addEventListener('click', () => {
                    props.command({ id: item.id });
                    popup.hide();
                  });
                  
                  component.appendChild(button);
                });

                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') {
                  popup[0].hide();
                  return true;
                }
                return false;
              },
              onExit: () => {
                popup[0].destroy();
              },
            };
          },
        },
      }),
      // Field references with # prefix
      Mention.configure({
        HTMLAttributes: {
          class: 'mention',
          'data-type': 'field',
        },
        suggestion: {
          char: '#',
          items: ({ query }: { query: string }): MentionItem[] => {
            // This would need to be populated with actual form fields
            // For now, we'll just return a placeholder
            return [
              {
                id: 'field',
                label: 'Form fields will appear here',
                type: 'field'
              }
            ];
          },
          render: () => {
            let popup: any;
            let component: HTMLDivElement;

            return {
              onStart: (props) => {
                component = document.createElement('div');
                component.classList.add('rounded-md', 'bg-white', 'shadow-md', 'border', 'p-1');
                
                popup = tippy(document.body, {
                  getReferenceClientRect: () => props?.clientRect?.() || new DOMRect(),
                  appendTo: () => document.body,
                  content: component,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                });
              },
              onUpdate: (props) => {
                component.innerHTML = '';
                
                props.items.forEach((item: MentionItem) => {
                  const button = document.createElement('button');
                  button.className = 'block w-full text-left px-2 py-1 hover:bg-gray-100 rounded';
                  button.textContent = item.label;
                  
                  button.addEventListener('click', () => {
                    props.command({ id: item.id });
                    popup.hide();
                  });
                  
                  component.appendChild(button);
                });

                popup[0].setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') {
                  popup[0].hide();
                  return true;
                }
                return false;
              },
              onExit: () => {
                popup[0].destroy();
              },
            };
          },
        },
      }),
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
  });

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

          {/* Alignment Controls */}
          <div className="flex items-center gap-1 border-r pr-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor?.isActive({ textAlign: 'left' }) && 'bg-muted')}
              onClick={() => editor?.chain().focus().setTextAlign('left').run()}
            >
              <FileText className="h-4 w-4" />
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
            <Button
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor?.isActive({ textAlign: 'justify' }) && 'bg-muted')}
              onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
            >
              <AlignJustify className="h-4 w-4" />
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
          </div>

          {/* Quote Control */}
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-8 w-8 p-0', editor?.isActive('blockquote') && 'bg-muted')}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            <TextQuote className="h-4 w-4" />
          </Button>
        </div>
        <EditorContent editor={editor} />
      </div>
      {isSelected && (
        <div className="mt-2 text-sm text-muted-foreground">
          <p>Type @ to reference variables</p>
          <p>Type # to reference form fields</p>
        </div>
      )}
    </div>
  );
}