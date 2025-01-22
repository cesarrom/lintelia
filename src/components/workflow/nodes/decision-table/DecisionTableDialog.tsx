'use client';

import { useEffect, useRef, useState } from 'react';
import DmnJS from 'dmn-js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DialogProps } from '../types';

export function DecisionTableDialog({ open, onOpenChange, data, onSave }: DialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dmnModeler, setDmnModeler] = useState<DmnJS | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const modeler = new DmnJS({
      container: containerRef.current,
      keyboard: {
        bindTo: document
      }
    });

    setDmnModeler(modeler);

    // Load existing DMN if available
    if (data.config?.xml) {
      modeler.importXML(data.config.xml as string);
    } else {
      // Create a new DMN table
      const newDmn = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="definitions" name="definitions" namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="decision" name="Decision">
    <decisionTable id="decisionTable">
      <input id="input1" label="Input 1">
        <inputExpression id="inputExpression1" typeRef="string">
          <text></text>
        </inputExpression>
      </input>
      <output id="output1" label="Output 1" name="result" typeRef="string" />
    </decisionTable>
  </decision>
</definitions>`;
      modeler.importXML(newDmn);
    }

    return () => {
      modeler.destroy();
    };
  }, [data.config?.xml]);

  const handleSave = async () => {
    if (!dmnModeler) return;

    try {
      const { xml } = await dmnModeler.saveXML({ format: true });
      onSave({
        ...data,
        config: {
          ...data.config,
          xml,
        },
      });
    } catch (err) {
      console.error('Error saving DMN:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] h-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Decision Table</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 flex flex-col">
          <div ref={containerRef} className="flex-1" />
          <div className="flex justify-end mt-4">
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 