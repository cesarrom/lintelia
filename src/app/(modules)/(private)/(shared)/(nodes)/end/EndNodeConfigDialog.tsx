'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';
import { VariableInput } from '@/components/ui/variable-input';
import { DialogProps } from '../../../(workflows)/(components)/nodes/types';
import { useNodeData } from '../../../(workflows)/(components)/WorkflowContext';
import { NodeData } from '../../../(workflows)/(components)/yaml/types';

type OutputItem = NonNullable<NodeData['exports']>[0]['outputs'][0]

export function EndNodeConfigDialog({
  open,
  onOpenChange,
  onSave,
  data: initialData
}: DialogProps) {
  const [data, setData] = useNodeData();
  
  // Get the event name from exports[0] or default to 'done'
  const [eventName, setEventName] = useState<string>(
    data?.exports?.[0]?.event || 'done'
  );
  
  // Get outputs from exports[0] or from config.outputs as fallback
  const [outputs, setOutputs] = useState<OutputItem[]>(
    (data?.exports?.[0]?.outputs as OutputItem[]) || 
    (data?.config?.outputs as OutputItem[]) || 
    []
  );
  
  const [newOutputName, setNewOutputName] = useState('');
  const [newOutputValue, setNewOutputValue] = useState('');

  // Update state when data changes
  useEffect(() => {
    setEventName(data?.exports?.[0]?.event || 'done');
    
    const currentOutputs = (data?.exports?.[0]?.outputs as OutputItem[]) || 
                          (data?.config?.outputs as OutputItem[]) || 
                          [];
    setOutputs(currentOutputs);
  }, [data]);

  const handleSave = () => {
    if (!data) return;
    
    const updatedData = {
      ...data,
      config: {
        ...data.config,
      },
      exports: [
        {
          event: eventName,
          outputs: outputs.map(output => ({
            name: output.name,
            value: output.value
          }))
        }
      ]
    };
    
    setData(updatedData);
    onOpenChange(false);
  };

  const addOutput = () => {
    if (!newOutputName) return;
    
    setOutputs([
      ...outputs,
      {
        name: newOutputName,
        value: newOutputValue
      }
    ]);
    
    setNewOutputName('');
    setNewOutputValue('');
  };

  const updateOutput = (index: number, field: keyof OutputItem, value: string) => {
    const updatedOutputs = [...outputs];
    updatedOutputs[index] = {
      ...updatedOutputs[index],
      [field]: value
    };
    
    setOutputs(updatedOutputs);
  };

  const removeOutput = (index: number) => {
    const updatedOutputs = [...outputs];
    updatedOutputs.splice(index, 1);
    
    setOutputs(updatedOutputs);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure End Node</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="grid gap-2">
            <Label htmlFor="event-name">Event Name</Label>
            <Input
              id="event-name"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="Event name"
            />
          </div>
          
          <div className="grid gap-2">
            <Label>Outputs for Event ({outputs.length})</Label>
            <div className="space-y-3">
              {outputs.length > 0 ? (
                outputs.map((output, index) => (
                  <Card key={index} className="relative">
                    <CardContent className="p-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => removeOutput(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      
                      <div className="grid gap-3">
                        <div className="grid gap-1">
                          <Label htmlFor={`output-name-${index}`}>Output Name</Label>
                          <Input
                            id={`output-name-${index}`}
                            value={output.name}
                            onChange={(e) => updateOutput(index, 'name', e.target.value)}
                            placeholder="Output name"
                          />
                        </div>
                        
                        <div className="grid gap-1">
                          <Label htmlFor={`output-value-${index}`}>Output Value</Label>
                          <VariableInput
                            value={output.value}
                            onChange={(value) => updateOutput(index, 'value', value)}
                            placeholder="Enter value or reference with {{}}"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center p-4 border border-dashed rounded-md text-muted-foreground">
                  No outputs defined yet. Add outputs below.
                </div>
              )}
            </div>
          </div>
          
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium mb-3">Add New Output</h3>
              <div className="grid gap-3">
                <div className="grid gap-1">
                  <Label htmlFor="new-output-name">Output Name</Label>
                  <Input
                    id="new-output-name"
                    value={newOutputName}
                    onChange={(e) => setNewOutputName(e.target.value)}
                    placeholder="Output name"
                  />
                </div>
                
                <div className="grid gap-1">
                  <Label htmlFor="new-output-value">Output Value</Label>
                  <VariableInput
                    value={newOutputValue}
                    onChange={setNewOutputValue}
                    placeholder="Enter value or reference with {{}}"
                  />
                </div>
                
                <Button 
                  type="button" 
                  onClick={addOutput}
                  disabled={!newOutputName}
                  className="mt-2"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Output
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 