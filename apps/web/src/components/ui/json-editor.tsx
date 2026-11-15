'use client';

import { cn } from "@/lib/utils";
import { CodeEditor } from "./code-editor";

export interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  error?: string;
  placeholder?: string;
}

export function JsonEditor({ 
  className,
  error,
  value,
  onChange,
  placeholder
}: JsonEditorProps) {
  return (
    <div className={cn(
      "space-y-1",
      error && "text-red-500",
      className
    )}>
      <CodeEditor
        value={value}
        onChange={onChange}
        language="json"
        placeholder={placeholder}
      />
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
} 