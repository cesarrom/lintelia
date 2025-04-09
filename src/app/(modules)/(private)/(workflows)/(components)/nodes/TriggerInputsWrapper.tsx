import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VariableInput } from "@/components/ui/variable-input";
import { useWorkflow } from "@/app/(modules)/(private)/(workflows)/(components)/WorkflowContext";
import { useTrigger } from './TriggerContext';
import { Input } from '@/components/ui/input';

interface TriggerInputsWrapperProps {
  children: React.ReactNode;
}

export function TriggerInputsWrapper({ children }: TriggerInputsWrapperProps) {
  const { workflow } = useWorkflow();
  const { currentTrigger, save } = useTrigger();

  const inputValues = currentTrigger?.action?.inputs || {};
  const updateInputValues = (values: Record<string, unknown>) => {
    currentTrigger.action.inputs = { ...inputValues, ...values };
    save(currentTrigger);
  };

  const updateTriggerName = (name: string) => {
    currentTrigger.name = name;
    save(currentTrigger);
  };

  return (
    <div className="space-y-6">
      {workflow.inputs && workflow.inputs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configure Workflow Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Trigger Name</label>
              <Input
                value={currentTrigger.name}
                onChange={(e) => updateTriggerName(e.target.value)}
              />
            </div>
            {workflow.inputs.map((input) => (
              <div key={input.id} className="space-y-2">
                <label className="text-sm font-medium">
                  {input.name}
                  {input.required && <span className="text-destructive ml-1">*</span>}
                </label>
                <VariableInput
                  includeTriggers={true}
                  value={(inputValues[input.name] || '').toString()}
                  onChange={(value) => updateInputValues({ ...inputValues, [input.name]: value })}
                  placeholder={`Value for ${input.name}`}
                />
                {input.description && (
                  <p className="text-sm text-muted-foreground">{input.description}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {children}
    </div>
  );
} 