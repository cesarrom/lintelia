"use client";

import { Form } from "@bpmn-io/form-js";
import React, { useRef, useEffect } from "react";
import "./viewer-styles.css"
import "./editor-styles.css"
import "./extracted-styles.css"
import "./decoration-styles.css"

import countries from './datasources/countries.json';
import professions from './datasources/professions.json'
import currencies from './datasources/currencies.json'

export default function FormViewer({ form, data = {}, disabled, onChange }: { form: any, onChange?: (data: any) => unknown, disabled: boolean, data?: any }) {
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
      documentTypes: [
        { label: 'ID CARD', value: 'GOVERNMENT_ID' },
        { label: 'PASSPORT', value: 'PASSPORT' },
        { label: 'DRIVERS LICENSE', value: 'DRIVERS_LICENSE' },
        { label: 'DOMESTIC PASSPORT', value: 'DOMESTIC_PASSPORT' },
        { label: 'PERMANENT RESIDENCE PERMIT', value: 'PERMANENT_RESIDENCE_PERMIT' },
        { label: 'REFUGEE CARD', value: 'REFUGEE_CARD' },
        { label: 'FOREIGN CITIZEN PASSPORT', value: 'FOREIGN_CITIZEN_PASSPORT' },
      ]
    }).then(console.log).catch(console.error);

    setFormEditor(formEditor);

    return () => {
      formEditor.destroy();
      setFormEditor(null);
    };
  }, [formEditorRef]);

  useEffect(() => {
    if (!formEditor) { return; }

    const fe = formEditor;

    const oc = ({ data: DATA }: any) => {
      onChange?.(DATA);
    }

    fe.on('changed', oc);

    return () => {
      fe.off('changed', oc);
    };
  }, [formEditor]);

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet" />
      <div className=" flex-1 flex flex-col">
        <div ref={formEditorRef} className="flex-1" style={{ width: '100%', height: '100%', pointerEvents: disabled ? 'none' : 'auto' }} />
      </div>
    </>
  );
}