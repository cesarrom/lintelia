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
import { TemplateEditor } from '@/components/ui/template-editor';
import { VariableInput } from '@/components/ui/variable-input';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { EmailNodeData } from '../types';
import { DialogProps } from '@radix-ui/react-dialog';
import { useNodeData } from '../../../WorkflowContext';


export function EmailDialog({ open, onOpenChange }: DialogProps) {
  const [node, setNode] = useNodeData();
  const [selectedTab, setSelectedTab] = useState<'template' | 'config'>('template');
  const [name, setName] = useState(node?.name || '');
  const [emailConfig, setEmailConfig] = useState<EmailNodeData>(() => {
    if (node?.config) {
      return node.config as EmailNodeData;
    }
    return {
      subject: '',
      template: '',
      to: '',
      cc: [],
    };
  });

  const handleSave = () => {
    setNode({
      ...node,
      name,
      config: {
        ...(node?.config || {}),
        ...emailConfig,
      },
    });
    onOpenChange?.(false);
  };

  const handleConfigChange = (value: string) => {
    try {
      debugger;
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
                    placeholder="Enter subject or reference a variable"
                  />
                </div>
                <div className="space-y-2">
                  <Label>To</Label>
                  <VariableInput
                    value={emailConfig.to || ''}
                    onChange={(value) => setEmailConfig({ ...emailConfig, to: value })}
                    placeholder="Enter email or reference a variable"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Template</Label>
                  <TemplateEditor
                    value={emailConfig.template}
                    onChange={(value) => setEmailConfig({ ...emailConfig, template: value })}
                    placeholder="Enter your email content here. Use {{variables}} for dynamic content."
                    height="250px"
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