'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeEditor } from '@/components/ui/code-editor';
import { VariableInput } from '@/components/ui/variable-input';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DialogProps } from '../types';
import { useNodes } from 'reactflow';

interface EmailConfig {
  subject: string;
  template: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
}

export function EmailDialog({ open, onOpenChange, data, onSave }: DialogProps) {
  const nodes = useNodes();
  const [selectedTab, setSelectedTab] = useState<'template' | 'config'>('template');
  const [name, setName] = useState(data.name);
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(() => {
    if (data.config?.email) {
      return data.config.email as EmailConfig;
    }
    return {
      subject: '',
      template: '',
      to: [],
      cc: [],
      bcc: [],
    };
  });

  const handleSave = () => {
    onSave({
      ...data,
      name,
      config: {
        ...data.config,
        email: emailConfig,
      },
    });
    onOpenChange(false);
  };

  const handleConfigChange = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      setEmailConfig(parsed);
    } catch (err) {
      console.error('Invalid JSON:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Email Configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Node Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter node name"
            />
          </div>
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'template' | 'config')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="template">Template</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
            </TabsList>
            <TabsContent value="template" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <VariableInput
                    value={emailConfig.subject}
                    onChange={(value) => setEmailConfig({ ...emailConfig, subject: value })}
                    nodes={nodes}
                    placeholder="Enter subject or reference a variable"
                  />
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <VariableInput
                    value={emailConfig.to[0] || ''}
                    onChange={(value) => setEmailConfig({ ...emailConfig, to: [value] })}
                    nodes={nodes}
                    placeholder="Enter email or reference a variable"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Template</Label>
                  <CodeEditor
                    value={emailConfig.template}
                    onChange={(value) => setEmailConfig({ ...emailConfig, template: value })}
                    language="html"
                    placeholder="<h1>Hello {{name}}</h1>"
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="config" className="space-y-4">
              <CodeEditor
                value={JSON.stringify(emailConfig, null, 2)}
                onChange={handleConfigChange}
                language="json"
                placeholder="{}"
              />
            </TabsContent>
          </Tabs>
          <div className="flex justify-end">
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 