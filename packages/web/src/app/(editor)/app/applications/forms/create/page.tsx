"use client";
import React, { useEffect, useRef } from 'react'
import "./viewer-styles.css"
import "./editor-styles.css"
import "./extracted-styles.css"
import "./decoration-styles.css"
import { FormEditor } from '@bpmn-io/form-js';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function CreateForm() {
  const formEditorRef = useRef<HTMLDivElement>(null)
  const [formEditor, setFormEditor] = React.useState<FormEditor | null>(null)

  useEffect(() => {
    if (!formEditorRef.current) { return; }

    const formEditor = new FormEditor({
      container: formEditorRef.current,
    });

    formEditor.importSchema({
      "id": "Form_1qoft98",
      "type": "default",
      "components": [],
      "exporter": {
        "name": "form-js (https://demo.bpmn.io)",
        "version": "1.8.3"
      },
      "schemaVersion": 16
    }).then(console.log).catch(console.error);

    formEditor.on('save', console.log);

    setFormEditor(formEditor);

    return () => {
      formEditor.destroy();
      setFormEditor(null);
    };
  }, [formEditorRef]);

  return (
    <>

      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet" />
      <div className="flex flex-col">
        <div ref={formEditorRef} className="flex-1" style={{ width: '100%', height: '100%' }} />
        <div className="flex flex-row gap-2 w-full">
          <Link href="/app/applications/forms" className='flex-1'>
            <Button  variant="outline" className='w-full'>
              Cancel
            </Button>
          </Link>
          <Button className='flex-1' onClick={() => console.log(formEditor?.saveSchema())}>
            Save
          </Button>
        </div>
      </div>
    </>
  );
}
