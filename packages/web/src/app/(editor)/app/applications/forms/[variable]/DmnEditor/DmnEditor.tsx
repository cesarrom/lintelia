'use client';
import { downloadDMN } from "@/actions/forms";
import { Form } from "@/actions/forms";
import DmnJS from "dmn-js/lib/Modeler";
import React from "react";
import { useRef } from "react";
import { Subject } from "rxjs";
const { migrateDiagram } = require('@bpmn-io/dmn-migrate');

const defaultXml = `<?xml version="1.0" encoding="UTF-8"?>
<definitions  xmlns="http://www.omg.org/spec/DMN/20151101/dmn.xsd" xmlns:biodi="http://bpmn.io/schema/dmn/biodi/1.0" xmlns:camunda="http://camunda.org/schema/1.0/dmn" id="definitions_1h6tkfz" name="definitions" namespace="http://camunda.org/schema/1.0/dmn">
</definitions>
`;

export default function DmnEditor({ form, domain, save$, onSave }: { form?: Form; domain: string; onSave: (xml: string) => void; save$: Subject<void> }) {
  const dmnEditorRef = useRef<HTMLDivElement>(null)
  const [dmnEditor, setDmnEditor] = React.useState<DmnJS | null>(null);
  const [xmlContent, setXmlContent] = React.useState<string | null>(null);
  const [fetching, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (xmlContent) return;

    if (!form) {
      setXmlContent(defaultXml);
      return;
    }

    const dmnUrl = form.dmnKey;

    if (!dmnUrl) {
      migrateDiagram(defaultXml).then(xml => {
        setXmlContent(xml as string);
      })
      return;
    }

    startTransition(async () => {
      const xml = await downloadDMN(domain, dmnUrl);

      migrateDiagram(xml).then(xml => {
        setXmlContent(xml as string);
      })
    });
  }, [domain]);

  React.useEffect(() => {
    if (!dmnEditor) return;

    dmnEditor.on('saveXML.done', ({ xml }) => {
      onSave(xml);
    });

    const sub = save$.subscribe(() => {
      console.log('saving dmn');
      dmnEditor.saveXML();
    });

    return () => {
      sub.unsubscribe();
      dmnEditor.off('saveXML.done');
    };
  }, [dmnEditor, save$, onSave])

  React.useLayoutEffect(() => {
    if (!dmnEditorRef.current || !xmlContent) { return; }

    const viewer = new DmnJS({
      container: dmnEditorRef.current,
      height: '100%',
      width: '100%',
      keyboard: {
        bindTo: window
      }
    });

    viewer.importXML(xmlContent, function (err) {
      if (err) {
        console.error('error rendering', err);
      } else {
        console.log('rendered');
      }
    });

    setDmnEditor(viewer);

    return () => {
      viewer.destroy();
      setDmnEditor(null);
    };
  }, [dmnEditorRef, xmlContent]);

  return <>
    <link rel="stylesheet" href="https://unpkg.com/dmn-js@16.6.2/dist/assets/diagram-js.css" />
    <link rel="stylesheet" href="https://unpkg.com/dmn-js@16.6.2/dist/assets/dmn-js-shared.css" />
    <link rel="stylesheet" href="https://unpkg.com/dmn-js@16.6.2/dist/assets/dmn-js-drd.css" />
    <link rel="stylesheet" href="https://unpkg.com/dmn-js@16.6.2/dist/assets/dmn-js-decision-table.css" />
    <link rel="stylesheet" href="https://unpkg.com/dmn-js@16.6.2/dist/assets/dmn-js-decision-table-controls.css" />
    <link rel="stylesheet" href="https://unpkg.com/dmn-js@16.6.2/dist/assets/dmn-js-literal-expression.css" />
    <link rel="stylesheet" href="https://unpkg.com/dmn-js@16.6.2/dist/assets/dmn-font/css/dmn.css" />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet" />
    <div className="flex flex-col h-screen w-screen">
      <div ref={dmnEditorRef} className={`flex-1 ${fetching ? 'hidden' : ''}`} style={{ width: '100%', height: '100%' }} />
      {fetching ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="spinner" />
        </div>
      ) : null}
    </div>
  </>
}