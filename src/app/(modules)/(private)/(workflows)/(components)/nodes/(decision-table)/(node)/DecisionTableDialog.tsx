'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import DmnJS from 'dmn-js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DialogProps } from '../../types';

export function DecisionTableDialog({ open, onOpenChange, data, onSave }: DialogProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dmnModeler, setDmnModeler] = useState<DmnJS | null>(null);

  useLayoutEffect(() => {
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
  }, [data.config?.xml, dmnModeler, open]);

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

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Edit Decision Table</DialogTitle>
      </DialogHeader>
      <DialogContent className="w-[calc(100dvw-100px)] h-[calc(100dvh-100px)] max-w-none">
          <div className="flex-1 min-h-0 flex flex-col bg-white text-black [&_.djs-container]:bg-white [&_.djs-container]:text-black">
            <div ref={containerRef} className="flex-1 w-full h-full" />
            <div className="flex justify-end mt-4">
              <Button onClick={handleSave} disabled={!dmnModeler}>Save</Button>
            </div>
          </div>
      </DialogContent>
    </Dialog>
  );
} 