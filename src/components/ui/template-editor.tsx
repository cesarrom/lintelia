'use client';

import { useEffect, useState, useRef } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import { cn } from '@/lib/utils';
import { useNodeData, useWorkflow } from '@/app/(modules)/(private)/(workflows)/(components)/WorkflowContext';

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  height?: string;
}

export function TemplateEditor({ 
  value, 
  onChange, 
  placeholder = 'Enter your template content here...',
  className,
  height = '300px'
}: TemplateEditorProps) {
  const { nodes } = useWorkflow();
  const [currentNode] = useNodeData();
  const [mounted, setMounted] = useState(false);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // Helper to get output type properties
  const getTypeProperties = (type: string | Record<string, unknown>): string[] => {
    if (typeof type === 'string') return [];
    if (type && typeof type === 'object') {
      if ('type' in type) {
        if (type.type === 'object' && 'properties' in type) {
          return Object.keys(type.properties as Record<string, unknown>);
        }
      }
    }
    return [];
  };

  // Configure Monaco editor on mount
  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define custom language for template with variable highlighting
    monaco.languages.register({ id: 'template' });
    
    // Define tokenizer for the template language
    monaco.languages.setMonarchTokensProvider('template', {
      tokenizer: {
        root: [
          // Match variable placeholders like {{variable}}
          [/{{[^{}]*}}/, 'variable'],
          // Match opening braces that might be the start of a variable
          [/{{/, 'variable.start'],
        ],
      },
    });

    // Define custom theme with variable highlighting
    monaco.editor.defineTheme('templateTheme', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'variable', foreground: '569cd6', fontStyle: 'bold' },
        { token: 'variable.start', foreground: '569cd6' },
      ],
      colors: {
        'editor.background': '#ffffff',
      },
    });

    // Apply the theme
    monaco.editor.setTheme('templateTheme');

    // Set up completion provider for variables
    monaco.languages.registerCompletionItemProvider('template', {
      triggerCharacters: ['{', '.'],
      provideCompletionItems: (model: any, position: any) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        // Check if we're typing a variable placeholder
        // Match either after {{ or after a dot within a variable context
        const openBraceMatch = textUntilPosition.match(/{{([\w.]*)$/);
        const dotMatch = textUntilPosition.match(/{{([\w.]+)\.$/);

        if (!openBraceMatch && !dotMatch) return { suggestions: [] };

        const match = dotMatch || openBraceMatch;
        const path = match[1];
        const parts = path.split('.');
        const suggestions: any[] = [];

        // Don't suggest the current node to avoid circular references
        const availableNodes = nodes.filter(n => n.id !== currentNode?.id);
        
        // If we just typed {{ or we're at the first part, suggest nodes
        if (parts.length <= 1 && !dotMatch) {
          availableNodes.forEach(node => {
            suggestions.push({
              label: node.data.name,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: `${node.data.name}.`,
              detail: `${node.data.type} node`,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column - (path?.length || 0) - (dotMatch ? 0 : 2),
                endLineNumber: position.lineNumber,
                endColumn: position.column
              }
            });
          });
        }
        // If we just typed a dot after a node name, suggest events
        else if ((parts.length === 2 && dotMatch) || (parts.length === 1 && dotMatch)) {
          const nodeName = parts[0];
          const node = availableNodes.find(n => n.data.name === nodeName);
          if (node) {
            node.data.events.forEach(event => {
              suggestions.push({
                label: event.name,
                kind: monaco.languages.CompletionItemKind.Event,
                insertText: `${event.name}.`,
                detail: `Event from ${nodeName}`,
                range: {
                  startLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endLineNumber: position.lineNumber,
                  endColumn: position.column
                }
              });
            });
          }
        }
        // If we just typed a dot after an event name, suggest outputs
        else if ((parts.length === 3 && dotMatch) || (parts.length === 2 && dotMatch)) {
          const [nodeName, eventName] = parts;
          const node = availableNodes.find(n => n.data.name === nodeName);
          if (node) {
            const event = node.data.events.find(e => e.name === eventName);
            if (event) {
              event.outputs.forEach(output => {
                const hasProperties = getTypeProperties(output.type).length > 0;
                const typeStr = typeof output.type === 'string' ? output.type : 'object';
                suggestions.push({
                  label: output.name,
                  kind: monaco.languages.CompletionItemKind.Variable,
                  insertText: `${output.name}${hasProperties ? '.' : '}}'}`,
                  detail: `Type: ${typeStr}${output.description ? ` - ${output.description}` : ''}`,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                  }
                });
              });
            }
          }
        }
        // If we just typed a dot after an output name, suggest output properties
        else if ((parts.length === 4 && dotMatch) || (parts.length === 3 && dotMatch)) {
          const [nodeName, eventName, outputName] = parts;
          const node = availableNodes.find(n => n.data.name === nodeName);
          if (node) {
            const event = node.data.events.find(e => e.name === eventName);
            if (event) {
              const output = event.outputs.find(o => o.name === outputName);
              if (output && typeof output.type === 'object' && 'properties' in output.type) {
                const properties = output.type.properties as Record<string, { type: string }>;
                Object.entries(properties).forEach(([prop, propType]) => {
                  suggestions.push({
                    label: prop,
                    kind: monaco.languages.CompletionItemKind.Property,
                    insertText: `${prop}}}`,
                    detail: `Type: ${propType.type}`,
                    range: {
                      startLineNumber: position.lineNumber,
                      startColumn: position.column,
                      endLineNumber: position.lineNumber,
                      endColumn: position.column
                    }
                  });
                });
              }
            }
          }
        }

        // If we have a partial match (not just after a dot), filter suggestions
        if (!dotMatch && parts[parts.length - 1]) {
          const searchTerm = parts[parts.length - 1].toLowerCase();
          return { 
            suggestions: suggestions.filter(s => 
              s.label.toLowerCase().includes(searchTerm)
            )
          };
        }

        return { suggestions };
      }
    });

    // Add key binding to trigger suggestions when typing {{
    editor.addCommand(monaco.KeyMod.chord(monaco.KeyCode.BracketLeft, monaco.KeyCode.BracketLeft), () => {
      // Insert {{ and trigger suggestions
      editor.trigger('keyboard', 'type', { text: '{{' });
      editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
    });

    // Listen for content changes to trigger suggestions
    editor.onDidChangeModelContent((e: any) => {
      const model = editor.getModel();
      if (!model) return;
      
      const position = editor.getPosition();
      if (!position) return;
      
      const line = model.getLineContent(position.lineNumber);
      const textBeforeCursor = line.substring(0, position.column - 1);
      
      // If we just typed {{ or a dot within a variable context, trigger suggestions
      if (textBeforeCursor.endsWith('{{') || 
          (textBeforeCursor.includes('{{') && !textBeforeCursor.includes('}}') && textBeforeCursor.endsWith('.'))) {
        setTimeout(() => {
          editor.trigger('keyboard', 'editor.action.triggerSuggest', {});
        }, 0);
      }
    });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      <Editor
        height={height}
        defaultLanguage="template"
        value={value || placeholder}
        onChange={(value) => onChange(value || '')}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineNumbers: 'on',
          tabSize: 2,
          wordWrap: 'on',
          wrappingIndent: 'same',
          lineDecorationsWidth: 0,
          glyphMargin: false,
          folding: false,
          renderLineHighlight: 'none',
          contextmenu: true,
          cursorStyle: 'line',
          automaticLayout: true,
          padding: { top: 8, bottom: 8 },
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true
          },
          suggestOnTriggerCharacters: true,
        }}
        onMount={handleEditorDidMount}
      />
    </div>
  );
} 