"use client";

import { Link } from "lucide-react";
import { Form } from "@bpmn-io/form-js";
import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import "./viewer-styles.css"
import "./editor-styles.css"
import "./extracted-styles.css"
import "./decoration-styles.css"

import countries from './datasources/countries.json';
import professions from './datasources/professions.json'
import currencies from './datasources/currencies.json'

export default function FormViewer({ form, data = {}, disabled, onSave }: { form: any, onSave: (data: any) => unknown, disabled: boolean, data?: any }) {
  const formEditorRef = useRef<HTMLDivElement>(null)
  const [formEditor, setFormEditor] = React.useState<Form | null>(null)

  useEffect(() => {
    if (!formEditorRef.current) { return; }

    const formEditor = new Form({
      container: formEditorRef.current,
    });

    formEditor.importSchema(form, {
      ...(data || {}),
      countries: countries.map(c => ({ label: c.name, value: c.code })),
      professions: professions.map(p => ({ label: p, value: p })),
      currencies: currencies.map(c => ({ label: c.name, value: c.code })),
    }).then(console.log).catch(console.error);

    setFormEditor(formEditor);

    return () => {
      formEditor.destroy();
      setFormEditor(null);
    };
  }, [formEditorRef]);

  return (
    <>

      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet" />
      <div className=" flex-1 flex flex-col">
        <div ref={formEditorRef} className="flex-1" style={{ width: '100%', height: '100%' }} />
        <div className="flex flex-row gap-2 w-full">
          <Button disabled={disabled} className='flex-1' onClick={() => onSave(formEditor?.submit()?.data)}>
            Save
          </Button>
        </div>
      </div>
    </>
  );
}