'use client';
import React from "react";
import { StepProps } from "../stepProps";
import FormViewer from "../../../FormViewer/FormViewer";
import { useParams, useSearchParams } from "next/navigation";
import { getTenant } from "@/actions/tenants";
import { getActiveFormByPurpose, getCurrentForm } from "@/actions/forms";
import { downloadFileContents } from "@/actions/files";
import { Application, getApplicationById, getApplicationsByUserId } from "@/actions/applications";
import { registerFormAnswers } from "@/actions/applications";
import { useUser } from "@descope/nextjs-sdk/client";
import { getUser } from "@/actions/users";
import { saveApplicationHeader } from "@/actions/applications";

export const Feature = 'Form';

export const Create = (props: StepProps & { disabled?: boolean }) => {
  const [sending, startTransition] = React.useTransition();
  const [user, setUser] = React.useState<ReturnType<typeof useUser>['user']>(null);
  const [domain, setDomain] = React.useState<string | null>(null);
  const [formId, setFormId] = React.useState<number | null>(null);
  const [applicationData, setApplicationData] = React.useState<any>(null);
  const [formSchema, setFormSchema] = React.useState<any>(null);
  const [applicationId, setApplicationId] = React.useState<number | null>(props.applicationId);
  const query = useSearchParams();
  const parentApplicationId = query.get('parentApplicationId');

  React.useEffect(() => {
    setApplicationId(props.applicationId);
  }, [props.applicationId]);

  React.useEffect(() => {
    startTransition(async () => {
      try {
        const tenant = await getTenant();
        const user = await getUser();
        setUser(user);
        setDomain(tenant.domain);
        const form = await getActiveFormByPurpose(tenant.domain, props.purpose);
        const formSchema = JSON.parse(
          await downloadFileContents(tenant.domain, form.formKey, 'utf-8')
        );
        setFormId(form.id);
        setFormSchema(formSchema);

        let application: Application;

        if (!applicationId) {

          const apps = await getApplicationsByUserId(tenant.domain, user.userId);

          const app = apps.find(app => app.status === 'in-progress');

          if (!app) return;


          application = app;

          setApplicationId(app.id);
        } else {
          application = await getApplicationById(tenant.domain, applicationId);
        }

        if (!application || !application.data) {
          return;
        }

        setApplicationData(JSON.parse(application.data));
      } catch (e) {
        console.error(e);
      }
    });
  }, [applicationId]);

  if (sending) {
    return <div>Loading...</div>;
  }

  return <FormViewer
    form={formSchema}
    data={applicationData}
    disabled={!!props.disabled}
    onSave={(DATA) => {
      startTransition(async () => {
        const { id } = applicationId ? await saveApplicationHeader(domain, {
          id: applicationId,
          data: JSON.stringify(DATA),
        }) : await registerFormAnswers(domain, { userId: user.userId, formId, data: DATA, parentApplicationId: Number(parentApplicationId), });
        props.onApplicationCreated(id);
        props.onDone();
      });
    }} />
};

export const Review = (props: StepProps) => <Create {...props} disabled={true} />;
