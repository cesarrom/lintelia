'use client';

import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VariableInput } from '@/components/ui/variable-input';
import { DocumentExtractorNodeData } from '../types';
import { DialogProps } from '../../(workflows)/(components)/nodes/types';
import { uploadFile } from '../../(shared)/(actions)/files';
import { useNodeConfig, useNodeData } from '../../(workflows)/(components)/WorkflowContext';

export function DocumentExtractorDialog({ open, onOpenChange }: DialogProps) {
  const [node, setNode] = useNodeData();
  const [nodeData, setNodeData] = useNodeConfig<DocumentExtractorNodeData>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      const fileId = await uploadFile(base64, file.name);
      setNodeData(prev => ({ ...prev, file: fileId }));
    };
    reader.readAsDataURL(file);
  };

  const handleVariableChange = (value: string) => {
    setNodeData(prev => ({ ...prev, file: value }));
  };

  if (!node) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Document Extractor Configuration</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <input
              value={node.name}
              onChange={(e) => setNode(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-2 border rounded"
              placeholder="Enter node name"
            />
          </div>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload File</TabsTrigger>
              <TabsTrigger value="variable">Use Variable</TabsTrigger>
            </TabsList>

            <TabsContent value="upload">
              <div className="space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*,.pdf"
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  Select File
                </Button>
                {nodeData?.file && !nodeData.file.startsWith('{{') && (
                  <p className="text-sm text-muted-foreground">File uploaded: {nodeData.file}</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="variable">
              <VariableInput
                value={nodeData?.file || ''}
                onChange={handleVariableChange}
                placeholder="Select variable containing file ID"
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}