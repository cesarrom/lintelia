"use client";
import React, { useEffect, useRef } from 'react'
import "./viewer-styles.css"
import "./editor-styles.css"
import "./extracted-styles.css"
import "./decoration-styles.css"
import { FormEditor as TheFormEditor } from '@bpmn-io/form-js';
import { Subject } from 'rxjs';

export default function FormEditor({ formSchema, save$, onSave }: { formSchema?: object; onSave: (schema: object) => void; save$: Subject<void> }) {
  const formEditorRef = useRef<HTMLDivElement>(null)
  const [formEditor, setFormEditor] = React.useState<TheFormEditor | null>(null);

  useEffect(() => {
    if (!formEditorRef.current) { return; }

    const formEditor = new TheFormEditor({
      container: formEditorRef.current,
    });

    const schema = formSchema ? formSchema : {
      "id": "Form_1qoft98",
      "type": "default",
      "components": [],
      "exporter": {
        "name": "form-js (https://demo.bpmn.io)",
        "version": "1.8.3"
      },
      "schemaVersion": 16
    };

    formEditor.importSchema(schema).then(console.log).catch(console.error);

    setFormEditor(formEditor);

    return () => {
      formEditor.destroy();
      setFormEditor(null);
    };
  }, [formEditorRef]);

  useEffect(() => {
    if (!formEditor) { return; }

    const sub = save$.subscribe(() => {
      console.log('saving form');
      onSave(formEditor.saveSchema());
    });

    return () => {
      sub.unsubscribe();
    };
  }, [formEditor, save$, onSave])

  return (
    <>

      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet" />
      <div className="flex flex-col">
        <div ref={formEditorRef} className="flex-1" style={{ width: '100%', height: '100%' }} />
      </div>
    </>
  );
}
