import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { v4 as uuid } from 'uuid';
import { TriggerProvider } from './TriggerContext';

import React from 'react';

import { schedulerTrigger } from "./(scheduler)/(trigger)";
import { formsTrigger } from "./(form)/(trigger)";
import { databaseTrigger } from "./(database)/(trigger)";
import { apiTrigger } from "./(api)/(trigger)";
import { usersTrigger } from "./(auth)/(trigger)";
import { TriggerDefinition } from "@/lib/triggers-utils";
import { WorkflowTrigger } from "../yaml/types";

// Define available trigger types
const triggerTypes = {
  scheduler: schedulerTrigger,
  forms: formsTrigger,
  database: databaseTrigger,
  api: apiTrigger,
  users: usersTrigger,
} as const;

interface AddTriggerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (trigger: WorkflowTrigger) => void;
}

export function AddTriggerDialog({ open, onOpenChange, onAdd }: AddTriggerDialogProps) {
  const [selectedType, setSelectedType] = useState<keyof typeof triggerTypes | null>(null);
  const [step, setStep] = useState<'select' | 'configure'>('select');

  const handleTypeSelect = (type: keyof typeof triggerTypes) => {
    setSelectedType(type);
    setStep('configure');
  };

  const handleBack = () => {
    setStep('select');
    setSelectedType(null);
  };

  const handleAdd = (trigger: TriggerDefinition) => {
    onAdd(trigger as unknown as WorkflowTrigger);
    onOpenChange(false);
    setStep('select');
    setSelectedType(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Workflow Trigger</DialogTitle>
        </DialogHeader>

        <Tabs value={step} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="select">Select Type</TabsTrigger>
            <TabsTrigger value="configure" disabled={!selectedType}>
              Configure
            </TabsTrigger>
          </TabsList>

          <TabsContent value="select" className="mt-4">
            <ScrollArea className="h-[60vh] pr-4">
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(triggerTypes).map(([type, def]) => (
                  <Card
                    key={type}
                    className="cursor-pointer transition-colors hover:bg-accent"
                    onClick={() => handleTypeSelect(type as keyof typeof triggerTypes)}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <def.icon className="h-5 w-5" />
                        {def.name}
                      </CardTitle>
                      <CardDescription>{def.description}</CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="configure" className="mt-4">
            {selectedType && (
              <div className="space-y-4">
                <Button variant="ghost" onClick={handleBack} className="mb-4">
                  ← Back to trigger types
                </Button>

                <TriggerProvider type={selectedType}>
                  {/* Render the configuration component for the selected trigger type */}
                  {React.createElement(triggerTypes[selectedType].configComponent)}
                </TriggerProvider>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 