"use server";

import { getInjector } from "@fintivio-sst/core/libs";
import { FilesService, FormsService } from "@fintivio-sst/core/services";
import { getUser } from "../users";

export const getAllForms = async (domain: string) => {
  const injector = await getInjector(domain);
  const formsService = injector.resolve(FormsService);

  return formsService.getAllForms();
}

export const getActiveFormById = async (domain: string, id: number) => {
  const injector = await getInjector(domain);
  const formsService = injector.resolve(FormsService);

  const validationFeatures = await formsService.getValidationFeaturesFromForms([id]);

  const form = await formsService.getFormById(id);

  return {
    ...form,
    validationFeatures: validationFeatures.map(({ featureId }) => featureId),
  }
}

export const getActiveFormByPurpose = async (domain: string, purpose: string) => {
  const injector = await getInjector(domain);
  const formsService = injector.resolve(FormsService);

  
  const form = await formsService.getFormByPurpose(purpose);
  
  const validationFeatures = await formsService.getValidationFeaturesFromForms([form.id]);

  return {
    ...form,
    validationFeatures: validationFeatures.map(({ featureId }) => featureId),
  }
}

export const downloadDMN = async (domain: string, dmnUrl: string) => {
  const injector = await getInjector(domain);

  const filesService = injector.resolve(FilesService);
  const dmn = await filesService.downloadFile(dmnUrl);

  return dmn.toString('utf-8')
}

export const listPurposes = async (domain: string, status?: string) => {
  const injector = await getInjector(domain);
  const formsService = injector.resolve(FormsService);

  return formsService.getPurposes(status);
}

export const getAvailableValidationFeatures = async (domain: string) => {
  const injector = await getInjector(domain);
  const formsService = injector.resolve(FormsService);

  return formsService.listAvailableValidationFeatures();
};

export const getDetailedForm = async (domain: string, formId: number) => {
  const injector = await getInjector(domain);
  const formsService = injector.resolve(FormsService);

  const form = await formsService.getFormById(formId);

  const validationFeatures = await formsService.getValidationFeaturesFromForms([formId]);

  return {
    ...form,
    validationFeatures: validationFeatures.map(({ featureId }) => featureId),
  }
}

export const setFormSchema = async (domain: string, id: number, form: object) => {
  const injector = await getInjector(domain);
  const formsService = injector.resolve(FormsService);
  const filesService = injector.resolve(FilesService);
  
  const f = await formsService.getFormById(id);
  const { Key } = await filesService.uploadFile(Buffer.from(JSON.stringify(form), 'utf-8'), f.purpose + '.json');
  
  return formsService.updateForm(id, {
    formKey: Key,
  })
}

export const updateDmn = async (domain: string, id: number, dmn: string) => {
  const injector = await getInjector(domain);
  const formsService = injector.resolve(FormsService);
  const filesService = injector.resolve(FilesService);
  const f = await formsService.getFormById(id);
  const { Key } = await filesService.uploadFile(Buffer.from(dmn, 'utf-8'), f.purpose + '.dmn');


  return formsService.updateForm(id, {
    dmnKey: Key,
  })
}

export const setFormHeaders = async (domain: string, id: number, title: string, description: string) => {
  const injector = await getInjector(domain);
  const formsService = injector.resolve(FormsService);

  return formsService.updateForm(id, {
    title,
    description,
  })
}

export const upsertForm = async (domain: string, form: Form & { validationFeatures?: string[] }, dmn: string, formSchema: object) => {
  const user = await getUser();
  const injector = await getInjector(domain);
  const formsService = injector.resolve(FormsService);
  const filesService = injector.resolve(FilesService);
  const f = form.id ? await formsService.getFormById(form.id) : form;

  const { Key } = await filesService.uploadFile(Buffer.from(JSON.stringify(formSchema), 'utf-8'), f.purpose + '.json');
  const { Key: dmnKey } = await filesService.uploadFile(Buffer.from(dmn, 'utf-8'), f.purpose + '.dmn');
  
  Object.assign(f, form);

  f.userId = user.userId;
  f.formKey = Key;
  f.dmnKey = dmnKey;

  return form.id ? formsService.updateForm(form.id, f) : formsService.createForm(f);
}

export const getCurrentForm = async (domain: string, purpose: string) => {
  const injector = await getInjector(domain);

  const formsService = injector.resolve(FormsService);

  const forms = await formsService.getFormByPurpose(purpose);

  return forms;
}

export type Form = Awaited<ReturnType<typeof getAllForms>>[0] & { validationFeatures: string[] };
export type ValidationFeature = Awaited<ReturnType<typeof getAvailableValidationFeatures>>[0];
