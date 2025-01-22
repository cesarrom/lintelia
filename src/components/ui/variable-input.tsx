'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Input } from './input';
import { NodeData } from '@/components/workflow/types';
import { cn } from '@/lib/utils';

export interface Variable {
  nodeId: string;
  nodeName: string;
  path: string;
  type: string;
  value?: unknown;
}

interface Suggestion {
  label: string;
  value: string;
}

interface VariableInputProps {
  value: string;
  onChange: (value: string) => void;
  nodes: NodeData[];
  className?: string;
  placeholder?: string;
}

export function VariableInput({
  value,
  onChange,
  nodes,
  className,
  placeholder,
}: VariableInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate suggestions based on the current input and cursor position
  useEffect(() => {
    if (!showSuggestions) return;

    const textBeforeCursor = value.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/{{(\w*)$/);

    if (match) {
      const searchTerm = match[1].toLowerCase();
      const newSuggestions: Suggestion[] = [];

      nodes.forEach((node) => {
        // Add input suggestions
        node.inputs?.forEach((input) => {
          const label = `${node.name}.${input.name}`;
          if (label.toLowerCase().includes(searchTerm)) {
            newSuggestions.push({
              label,
              value: `{{${label}}}`,
            });
          }
        });

        // Add output suggestions
        node.outputs?.forEach((output) => {
          const label = `${node.name}.${output.name}`;
          if (label.toLowerCase().includes(searchTerm)) {
            newSuggestions.push({
              label,
              value: `{{${label}}}`,
            });
          }
        });
      });

      setSuggestions(newSuggestions);
    } else {
      setSuggestions([]);
    }
  }, [value, cursorPosition, nodes, showSuggestions]);

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
    }
    
    setShowSuggestions(false);
  };

  return (
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
                {suggestion.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 