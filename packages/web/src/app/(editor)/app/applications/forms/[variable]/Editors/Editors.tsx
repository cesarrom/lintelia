'use client';

import React from 'react';
import { Form, listPurposes, ValidationFeature } from '@/actions/forms';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import FormEditor from '../FormEditor/FormEditor';
import DmnEditor from '../DmnEditor/DmnEditor';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { BehaviorSubject, combineLatest, debounceTime, Subject } from 'rxjs';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Formik } from 'formik';
import { upsertForm } from '@/actions/forms';
import Autocomplete from '@/components/Autocomplete';
import FormFeatures from '@/components/FormFeatures';
import { uploadFile } from '@/actions/files';
import { getTenant, GetTenant } from '@/actions/tenants';
import base64 from 'base64-encode-file'

export default function Editors({ form, formSchema, domain, validationFeatures }: { form?: Form; formSchema?: object; domain: string; userId: string, validationFeatures: ValidationFeature[] }) {
  const [_, startStateTransition] = React.useTransition();
  const [tenant, setTenant] = React.useState<GetTenant | null>(null);
  const [sending, startSendTransition] = React.useTransition();
  const save$ = React.useRef<Subject<void>>(new Subject<void>());
  const form$ = React.useRef<Subject<Form>>(new BehaviorSubject<Form>(form));
  const schema$ = React.useRef<Subject<object>>(new Subject<object>());
  const xml$ = React.useRef<Subject<string>>(new Subject<string>());
  const [tab, setTab] = React.useState<"form" | "dmn">("form");
  const [purposes, setPurposes] = React.useState<string[]>([]);
  const [contractKey, setContractKey] = React.useState<string>("");

  React.useEffect(() => {
    startStateTransition(async () => {
      setTenant(await getTenant());
      const purposes = await listPurposes(domain);
      setPurposes(purposes);
    });
  }, []);
  React.useEffect(() => {
    const sub = combineLatest([form$.current, xml$.current, schema$.current])
      .pipe(
        debounceTime(500),
      )
      .subscribe(([form, xml, schema]) => {
        startSendTransition(async () => {
          if (contractKey) {
            console.log(contractKey.length, 'contractKey');
            form.contractKey = await uploadFile(null, contractKey, tenant.domain + '__' + form.purpose + '_terms.pdf');
          }
          await upsertForm(domain, form, xml, schema);
          window.location.href = `/app/applications/forms`;
        });
      });

    return () => {
      sub.unsubscribe();
    };
  }, [contractKey]);

  return (
    <Formik
      initialValues={form}
      onSubmit={async (values: Form) => {

        save$.current.next();
        form$.current.next(values);
      }}
    >
      {({
        values,
        handleChange,
        handleBlur,
        handleSubmit,
        isSubmitting,
        /* and other goodies */
      }) => (
        <form onSubmit={handleSubmit} className="w-full">
          <Card className="w-full mx-auto">
            <CardContent>
              <div className="mb-6">
                <Label htmlFor="title" className="block mb-1 mt-6">Form Title</Label>
                <Input
                  required
                  type="text"
                  placeholder="Form Title"
                  id="title"
                  name="title"
                  disabled={isSubmitting || sending}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  defaultValue={values?.title || ''}
                  value={values?.title || ''}
                  className="mb-2"
                />
                <Label htmlFor="description" className="block mb-1">Form Description</Label>
                <Textarea

                  placeholder="Form Description"
                  id="description"
                  name="description"
                  disabled={isSubmitting || sending}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  defaultValue={values?.description || ''}
                  value={values?.description || ''}
                />
                <Label htmlFor="purpose" className="block mb-1">Form Purpose</Label>
                <Autocomplete
                  required
                  id="purpose"
                  name="purpose"
                  suggestions={purposes}
                  value={values?.purpose || ''}
                  onBlur={handleBlur}
                  disabled
                  onSelect={purpose => {
                    handleChange({
                      target: {
                        name: 'purpose',
                        value: purpose
                      }
                    });
                  }} />
                <Label htmlFor="terms" className="block mb-1">Terms and Conditions PDF</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  id="contractKey"
                  name="contractKey"
                  disabled={isSubmitting || sending}
                  onChange={async event => {
                    const file = event.target.files?.[0];
                    if (file) {
                      setContractKey(await base64(file) as string);
                    }
                  }}
                  onBlur={handleBlur}
                  className="mb-2"
                />


                <FormFeatures
                  value={form.validationFeatures}
                  features={validationFeatures}
                  disabled={isSubmitting || sending}
                  onChange={features => {
                    handleChange({
                      target: {
                        name: 'validationFeatures',
                        value: features
                      }
                    });
                  }}
                />
              </div>

              <Tabs defaultValue="form" className="w-full" onValueChange={tab => setTab(tab as "form" | "dmn")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="form">Form Editor</TabsTrigger>
                  <TabsTrigger value="dmn">DMN Editor</TabsTrigger>
                </TabsList>
                <TabsContent value="form" forceMount className={tab === "form" ? "block" : "hidden"}>
                  <FormEditor save$={save$.current} formSchema={formSchema} onSave={schema => {
                    schema$.current.next(schema);
                  }} />
                </TabsContent>
                <TabsContent value="dmn" forceMount className={tab === "dmn" ? "block" : "hidden"}>
                  <DmnEditor save$={save$.current} form={form} domain={domain} onSave={xml => {
                    xml$.current.next(xml);
                  }} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          <div className="fixed bottom-4 right-4 flex flex-row gap-2">
            <Link href="/app/applications/forms">
              <Button variant="outline" className="rounded-full w-10 h-10 p-0" disabled={sending || isSubmitting}>
                {sending || isSubmitting ? <span className="animate-spin">↻</span> : "X"}
              </Button>
            </Link>
            <Button
              className="rounded-full w-10 h-10 p-0"
              type="submit"
              disabled={sending || isSubmitting}
            >
              {sending || isSubmitting ? <span className="animate-spin">↻</span> : "✓"}
            </Button>
          </div>
        </form>
      )
      }

    </Formik>
  );
}
