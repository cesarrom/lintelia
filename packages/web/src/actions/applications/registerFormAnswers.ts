"use server";

import { getInjector } from "@fintivio-sst/core/libs";
import { ApplicationsService } from "@fintivio-sst/core/services";

export const registerFormAnswers = async (domain: string, userId: string, formId: number, answers: object) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);

  const result = await applicationsService.createApplication({
    userId: userId,
    formId: formId,
    data: answers,
  });

  return {
    ...result,
    data: JSON.parse(result.data),
  }
}

export type CreatedApplication = Awaited<ReturnType<typeof registerFormAnswers>>;