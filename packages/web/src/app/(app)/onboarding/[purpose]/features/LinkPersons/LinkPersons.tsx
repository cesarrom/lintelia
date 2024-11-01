import React from "react";
import { StepProps } from "../stepProps";
import { Form, getAllForms } from "@/actions/forms";
import { InviteeList } from "@/components/InviteApplicants";
import { getTenant } from "@/actions/tenants";
import { Button } from "@/components/ui/button";
import { getValidationFeatureResponse, linkApplicant, registerValidationFeatureResponse } from "@/actions/applications";
import { getUser } from "@/actions/users";

export const Feature = 'Link Persons';

export const Create = (props: StepProps & { disabled?: boolean }) => {
  const [sending, startTransition] = React.useTransition();
  const [value, setValue] = React.useState<{ [key: string]: string }>({});

  React.useEffect(() => {
    startTransition(async () => {
      const tenant = await getTenant();
      const user = await getUser();

      setValue(v => ({
        ...v,
        [user.email]: 'founder',
      }));

      const response = await getValidationFeatureResponse(tenant.domain, props.applicationId, Feature);

      if (response && response.data) {
        setValue(JSON.parse(response.data));
      }
    });
  }, []);

  return <>
    <InviteeList
      title="Linked Persons"
      disabled={sending || props.disabled}
      values={['executive director', 'founder',  'director', 'shareholder']}
      value={value}
      onChange={value => {
        setValue(value);
      }}
    />
    <Button disabled={sending || props.disabled} onClick={() => {
      startTransition(async () => {
        const tenant = await getTenant();

        const data = value;

        await registerValidationFeatureResponse(tenant.domain, props.applicationId, Feature, data);

        await Promise.all(Object.entries(data).map(([email, role]) => {
          if (role) {
            return linkApplicant(tenant.domain, props.applicationId, email, role);
          }

          return Promise.resolve();
        }));

        props.onDone();
      });
    }}>{sending ? 'Loading' : 'Next'}</Button>
  </>
};

export const Review = (props: StepProps) => <Create {...props} disabled={true} />;
