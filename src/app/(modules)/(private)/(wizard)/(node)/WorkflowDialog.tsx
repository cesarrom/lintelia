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
import { DialogProps } from '../types';

interface WorkflowConfig {
  workflowId: string;
  inputMappings: Record<string, string>;
  outputMappings: Record<string, string>;
}

export function WorkflowDialog({ open, onOpenChange, data, onSave }: DialogProps) {
  const [selectedTab, setSelectedTab] = useState<'mappings' | 'config'>('mappings');
  const [workflowConfig, setWorkflowConfig] = useState<WorkflowConfig>(() => {
    if (data?.config?.workflow) {
      return data.config.workflow as WorkflowConfig;
    }
    return {
      workflowId: '',
      inputMappings: {},
      outputMappings: {},
    };
  });

  const handleSave = () => {
    onSave({
      ...data,
      config: {
        ...data.config,
        workflow: workflowConfig,
      }
    });
  };

  const handleConfigChange = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      setWorkflowConfig(parsed);
    } catch (err) {
      console.error('Invalid JSON:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Workflow Configuration</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as 'mappings' | 'config')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="mappings">Mappings</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
            </TabsList>
            <TabsContent value="mappings" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Input Mappings</h3>
                  <CodeEditor
                    value={JSON.stringify(workflowConfig.inputMappings, null, 2)}
                    onChange={(value) => {
                      try {
                        const parsed = JSON.parse(value);
                        setWorkflowConfig({
                          ...workflowConfig,
                          inputMappings: parsed,
                        });
                      } catch (err) {
                        console.error('Invalid JSON:', err);
                      }
                    }}
                    language="json"
                    placeholder="{}"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2">Output Mappings</h3>
                  <CodeEditor
                    value={JSON.stringify(workflowConfig.outputMappings, null, 2)}
                    onChange={(value) => {
                      try {
                        const parsed = JSON.parse(value);
                        setWorkflowConfig({
                          ...workflowConfig,
                          outputMappings: parsed,
                        });
                      } catch (err) {
                        console.error('Invalid JSON:', err);
                      }
                    }}
                    language="json"
                    placeholder="{}"
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="config" className="space-y-4">
              <CodeEditor
                value={JSON.stringify(workflowConfig, null, 2)}
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