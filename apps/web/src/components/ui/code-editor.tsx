'use client';

import { useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  placeholder?: string;
}

export function CodeEditor({ value, onChange, language = 'javascript', placeholder }: CodeEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="border rounded-md">
      <Editor
        height="200px"
        defaultLanguage={language}
        value={value || placeholder}
        onChange={(value) => onChange(value || '')}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineNumbers: 'on',
          tabSize: 2,
        }}
      />
    </div>
  );
} 