'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';
import { useSystemGetSystemVariables } from '@/lib/services/system.hooks';
import { useNodeData, useWorkflow } from '@/app/modules/private/workflows/components/WorkflowContext';

interface Suggestion {
  label: string;
  value: string;
  description?: string;
}

interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  includeTriggers?: boolean;
}

export function VariableInput({
  value,
  onChange,
  className,
  placeholder,
  includeTriggers = false,
}: VariableInputProps) {
  const { data: systemVariables = [] } = useSystemGetSystemVariables();
  const { nodes: nodesRef, triggers: triggersRef } = useWorkflow();
  const [currentNode] = useNodeData();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [currentType, setCurrentType] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const systemVariablesItem = React.useMemo(() => ({
    id: 'system_variables',
    type: 'system_variables',
    data: {
      name: 'System',
      events: [{
        name: 'variables',
        outputs: systemVariables.map(v => ({
          name: v.name,
          type: v.type,
          description: v.name,
        }))
      }],
    }
  }), [systemVariables]);

  const nodes = React.useMemo(() => {
    if (includeTriggers) {
      return [
        systemVariablesItem,
        {
        id: 'triggers',
        type: 'trigger',
        data: {
          name: 'Triggers',
          events: triggersRef?.map(t => ({
            name: t.name,
            outputs: []
          }))
        }
      }];
    }

    return [systemVariablesItem, ...nodesRef];
  }, [nodesRef, triggersRef, includeTriggers, systemVariablesItem]);

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

  // Helper to get variable type from path
  const getVariableType = React.useCallback((path: string): string | null => {
    if (!path) return null;
    
    if (!path.startsWith('{{') || !path.endsWith('}}')) return null;
    
    const parts = path.slice(2, -2).split('.');
    if (parts.length < 3) return null;

    const [nodeName, eventName, outputName, propName] = parts;
    const node = nodes.find(n => n.data.name === nodeName);
    if (!node) return null;

    const event = node.data.events.find(e => e.name === eventName);
    if (!event) return null;

    const output = event.outputs.find(o => o.name === outputName);
    if (!output) return null;

    if (propName) {
      if (typeof output.type === 'object' && 'properties' in output.type) {
        const properties = (output.type as any).properties as Record<string, { type: string }>;
        return properties[propName]?.type || null;
      }
      return null;
    }

    return typeof output.type === 'string' ? output.type : 'object';
  }, [nodes]);

  // Generate suggestions based on the current input and cursor position
  useEffect(() => {
    if (!showSuggestions) return;

    const textBeforeCursor = value.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/{{([\w.]*?)$/);

    if (match) {
      const path = match[1];
      const parts = path.split('.');
      const newSuggestions: Suggestion[] = [];

      // Don't suggest the current node to avoid circular references
      const availableNodes = nodes.filter(n => n.id !== currentNode?.id);

      // If no dot yet, suggest nodes
      if (parts.length <= 1) {
        availableNodes.forEach(node => {
          newSuggestions.push({
            label: node.data.name,
            value: `{{${node.data.name}.`,
            description: `${(node.data as any).type} node`,
          });
        });
      }
      // If one dot, suggest events
      else if (parts.length === 2) {
        const nodeName = parts[0];
        const node = availableNodes.find(n => n.data.name === nodeName);
        if (node) {
          node.data.events.forEach(event => {
            newSuggestions.push({
              label: event.name,
              value: `{{${nodeName}.${event.name}.`,
              description: `Event from ${nodeName}`,
            });
          });
        }
      }
      // If two dots, suggest outputs
      else if (parts.length === 3) {
        const [nodeName, eventName] = parts;
        const node = availableNodes.find(n => n.data.name === nodeName);
        if (node) {
          const event = node.data.events.find(e => e.name === eventName);
          if (event) {
            event.outputs.forEach(output => {
              const hasProperties = getTypeProperties(output.type).length > 0;
              const typeStr = typeof output.type === 'string' ? output.type : 'object';
              newSuggestions.push({
                label: output.name,
                value: `{{${nodeName}.${eventName}.${output.name}${hasProperties ? '.' : '}}'}`,
                description: `Type: ${typeStr}${output.description ? ` - ${output.description}` : ''}`,
              });
            });
          }
        }
      }
      // If three dots, suggest output properties
      else if (parts.length === 4) {
        const [nodeName, eventName, outputName] = parts;
        const node = availableNodes.find(n => n.data.name === nodeName);
        if (node) {
          const event = node.data.events.find(e => e.name === eventName);
          if (event) {
            const output = event.outputs.find(o => o.name === outputName);
            if (output && typeof output.type === 'object' && 'properties' in output.type) {
              const properties = (output.type as any).properties as Record<string, { type: string }>;
              Object.entries(properties).forEach(([prop, propType]) => {
                newSuggestions.push({
                  label: prop,
                  value: `{{${nodeName}.${eventName}.${outputName}.${prop}}}`,
                  description: `Type: ${propType.type}`,
                });
              });
            }
          }
        }
      }

      // Filter suggestions based on the current input
      const searchTerm = parts[parts.length - 1].toLowerCase();
      setSuggestions(
        newSuggestions.filter(s => 
          s.label.toLowerCase().includes(searchTerm)
        )
      );
    } else {
      setSuggestions([]);
    }
  }, [value, cursorPosition, nodes, currentNode, showSuggestions]);

  // Update current type when value changes
  useEffect(() => {
    const type = getVariableType(value);
    setCurrentType(type);
  }, [value, nodes, getVariableType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setCursorPosition(e.target.selectionStart || 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === '{' && e.shiftKey) {
      setShowSuggestions(true);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);
    const lastOpenBrace = textBeforeCursor.lastIndexOf('{{');
    
    if (lastOpenBrace !== -1) {
      const newValue = textBeforeCursor.slice(0, lastOpenBrace) + suggestion.value + textAfterCursor;
      onChange(newValue);
      
      // Update cursor position to end of suggestion
      const newCursorPos = lastOpenBrace + suggestion.value.length;
      setCursorPosition(newCursorPos);
      
      // If the suggestion doesn't end with }}, keep showing suggestions
      if (!suggestion.value.endsWith('}}')) {
        setShowSuggestions(true);
        // Focus input and set cursor position after React re-render
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          }
        }, 0);
      } else {
        setShowSuggestions(false);
      }
    }
  };

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          className={cn('font-mono', className)}
          placeholder={placeholder}
        />
        
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-popover text-popover-foreground shadow-md rounded-md border border-border overflow-hidden">
            <div className="max-h-[200px] overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  className={cn(
                    'w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground',
                    'focus:bg-accent focus:text-accent-foreground focus:outline-none'
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSuggestionClick(suggestion);
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span>{suggestion.label}</span>
                    {suggestion.description && (
                      <span className="text-xs text-muted-foreground">{suggestion.description}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {currentType && (
        <p className="text-xs text-muted-foreground px-1">Type: {currentType}</p>
      )}
    </div>
  );
} 