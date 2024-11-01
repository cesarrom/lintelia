import React from 'react';
import { getTenant } from '@/actions/tenants';
import { getUser } from '@/actions/users';
import { Form, getActiveFormById, getActiveFormByPurpose, getAvailableValidationFeatures } from '@/actions/forms';
import Editors from './Editors/Editors';
import { downloadFileContents } from '@/actions/files';

const isNumber = (value: any) => !isNaN(Number(value));

export default async function Editor({ params }: { params: { variable: string } }) {
  const { variable } = params;
  const tenant = await getTenant();
  const user = await getUser();

  const form = isNumber(variable) ? await getActiveFormById(tenant.domain, parseInt(variable)) : variable === 'create' ? ({} as Form) : await getActiveFormByPurpose(tenant.domain, variable);
  const availableFeatures = await getAvailableValidationFeatures(tenant.domain);

  const formSchema = form.formKey ? await JSON.parse(
    await downloadFileContents(tenant.domain, form.formKey, 'utf-8')
  ) : undefined;

  return (
    <Editors form={form} formSchema={formSchema} userId={user.userId} domain={tenant.domain} validationFeatures={availableFeatures} />
  );

}
