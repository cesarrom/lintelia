"use server";

import { auth } from "@fintivio-sst/core/clients/auth.client";
import { ApplicationsService, EmailsService, FilesService, FormsService, InvitationsService, UserRolesService } from "@fintivio-sst/core/services";
import { v4 as uuid } from 'uuid';
import { getUser } from "../users";
import { getTenant } from "../tenants";
import { Resource } from "sst";
import { getInjector } from "@fintivio-sst/core/libs/injector";

const contractUniqueMessage = "Upload the contract with your signature";

export const getApplicationsByUserId = async (domain: string, userId: string, parentApplicationId?: number) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);

  return applicationsService.getApplicationsByUserId(userId, parentApplicationId);
}

export const getAllApplications = async (domain: string, role?: string) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);

  const response = await applicationsService.getAllApplications(role);

  const users = await auth.management.user.searchAll();
  const usersByUserId = users.data.reduce((acc, user) => {
    acc[user.userId] = user;
    return acc;
  }, {} as Record<string, (typeof users.data)[0]>);


  return response.map(application => {
    const user = usersByUserId[application.applicants.userId];
    return {
      application: application.applications,
      user,
    }
  });
}

export const getApplicationById = async (domain: string, applicationId: number) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);
  return applicationsService.getApplicationById(applicationId);
}

export const getLinkedApplications = async (domain: string, applicationId: number) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);
  const applicants = await applicationsService.getAllApplicantsByApplicationId(applicationId);
  const applications: (Application & { userId: string })[] = await Promise.all(
    applicants.map(
      applicant => applicationsService.getApplicationsByUserId(applicant).then(
        apps => apps.map(a => Object.assign({}, a, { userId: applicant }) as Application & { userId: string })
      )
    )
  ).then(a => a.flat());

  return applications.filter(application => application.id !== applicationId);
}

export const getApplicants = async (domain: string, applicationId: number) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);
  const applicants = await applicationsService.getAllApplicantsByApplicationId(applicationId);
  const users = await auth.management.user.searchAll();
  const usersByUserId = users.data.reduce((acc, user) => {
    acc[user.userId] = user;
    return acc;
  }, {} as Record<string, (typeof users.data)[0]>);

  return applicants.map(applicant => {
    const user = usersByUserId[applicant];
    return user;
  });
}

export const registerFormAnswers = async (domain: string, application: Partial<Omit<Application, 'id' | 'data'>> & { userId: string, data: object }) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);
  const userRolesService = injector.resolve(UserRolesService);
  const formsService = injector.resolve(FormsService);
  const { formId, userId, data: answers } = application;
  const form = await formsService.getFormById(formId);

  const result = await applicationsService.createApplication({
    ...application,
    formId: formId,
    data: JSON.stringify(answers),
    applicationPurpose: form.purpose,
  });

  await applicationsService.linkApplicant(result.id, userId);

  const risk = await applicationsService.evaluateRisk(result.id, answers);

  await userRolesService.createUserRole({
    role: 'user',
    userId,
  })

  return {
    ...result,
    risk,
    data: JSON.parse(result.data),
  }
}

export const getRiskByApplicationId = async (domain: string, applicationId: number, answers?: object) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);
  const result = answers || await applicationsService.getApplicationById(applicationId).then(r => JSON.parse(r.data))
  
  const risk = await applicationsService.evaluateRisk(applicationId, result);

  return risk;
}

export const addAdditionalRequest = async (domain: string, id: number, additionalRequest: AdditionalRequest) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);
  const emailsService = injector.resolve(EmailsService);

  const f = await applicationsService.getApplicationById(id);

  const data = JSON.parse(f.data);

  additionalRequest.id = uuid();

  const additionalRequests = data.additionalRequests || [];

  await applicationsService.updateApplication(id, {
    data: JSON.stringify({
      ...data,
      additionalRequests: [...additionalRequests, additionalRequest],
    })
  });

  const tenant = await getTenant();
  
  const userIds = await applicationsService.getAllApplicantsByApplicationId(id);
  
  const users = await Promise.all(userIds.map(async (userId) => {
    return await getUser(userId);
  }));

  const user = users.shift();

  const htmlMessage = `
  <html>
    <body>      
      <p>We need some additional information for your application.</p>
      
      <p>Request: ${additionalRequest.request}</p>
      
      <p>Please <a href="http${Resource.App.stage === 'local' ? '' : 's'}://${tenant.domain}.${Resource.App.stage === 'main' ? '' : Resource.App.stage + '.'}fintivio.org/sign-on">log in to your account</a> to provide the requested information.</p>
      
      <p>Best regards,<br>${tenant.name} Team</p>
    </body>
  </html>
  `;


  // Send email to the user about the additional information request
  await emailsService.sendEmail(
    user.email,
    'Additional Information Request for ' + tenant.name + ' account',
    '',
    htmlMessage,
    users.map(u => u.email)
  );


  return additionalRequest;
}

export const sendContract = async (domain: string, id: number, fileRef: string): Promise<AdditionalRequest> => {
  console.log('fileRef', fileRef.slice(0, 100))
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService)
  const emailsService = injector.resolve(EmailsService)
  const s3Service = injector.resolve(FilesService)

  const f = await applicationsService.getApplicationById(id)
  const data = JSON.parse(f.data)

  const contractRequest = {
    id: uuid(),
    request: contractUniqueMessage,
    type: 'file',
    status: 'pending',
  }

  const additionalRequests = data.additionalRequests || []

  await applicationsService.updateApplication(id, {
    status: 'contract-sent',
    data: JSON.stringify({
      ...data,
      additionalRequests: [...additionalRequests, contractRequest],
    })
  })

  const tenant = await getTenant()

  const userIds = await applicationsService.getAllApplicantsByApplicationId(id);
  
  const users = await Promise.all(userIds.map(async (userId) => {
    return await getUser(userId);
  }));

  const user = users.shift();

  const metadata = await s3Service.uploadFile(
    Buffer.from(fileRef, 'base64'),
    user.userId + '--' + new Date().getTime() + '_contract.pdf'
  );
  const signedUrl = await s3Service.getSignedUrl(metadata.Key)

  const htmlMessage = `
  <html>
    <body>      
      <p>We have sent you a contract that requires your signature.</p>
      
      <p>Request: ${contractRequest.request}</p>
      
      <p>You can download the contract <a href="${signedUrl}">here</a>.</p>
      
      <p>After signing, please <a href="http${Resource.App.stage === 'local' ? '' : 's'}://${tenant.domain}.${Resource.App.stage === 'main' ? '' : Resource.App.stage + '.'}fintivio.org/sign-on">log in to your account</a> to upload the signed contract.</p>
      
      <p>Best regards,<br>${tenant.name} Team</p>
    </body>
  </html>
  `

  await emailsService.sendEmail(
    user.email,
    'Contract Signature Request for ' + tenant.name + ' account',
    '',
    htmlMessage,
    users.map(u => u.email)
  )

  return contractRequest as AdditionalRequest;
}

export const answerRequestWithNumber = async (domain: string, id: number, requestId: string, answer: number) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);

  const f = await applicationsService.getApplicationById(id);

  const data = JSON.parse(f.data);

  const additionalRequests = data.additionalRequests || [];

  const request: AdditionalRequest = additionalRequests.find(r => r.id === requestId);

  if (!request) {
    throw new Error('Request not found');
  }

  request.status = 'answered';
  request.response = answer.toString();

  await applicationsService.updateApplication(id, {
    data: JSON.stringify({
      ...data,
      additionalRequests: [...additionalRequests],
    })
  })

  return request;
}

export const answerRequestWithText = async (domain: string, id: number, requestId: string, answer: string) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);

  const f = await applicationsService.getApplicationById(id);

  const data = JSON.parse(f.data);

  const additionalRequests = data.additionalRequests || [];

  const request: AdditionalRequest = additionalRequests.find(r => r.id === requestId);

  if (!request) {
    throw new Error('Request not found');
  }

  request.status = 'answered';
  request.response = answer;

  await applicationsService.updateApplication(id, {
    data: JSON.stringify({
      ...data,
      additionalRequests: [...additionalRequests],
    })
  })

  return request;
}

export const answerRequestWithFile = async (domain: string, id: number, requestId: string, fileRef: string, fileName: string) => {
  console.log('fileRef', fileRef.slice(0, 100))
  // make sure that it does not include "base64" header
  const file = fileRef.startsWith('data:') ? fileRef.split(',')[1] : fileRef
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);
  const filesService = injector.resolve(FilesService);
  const user = await getUser();

  const f = await applicationsService.getApplicationById(id);

  const buffer = Buffer.from(file, 'base64');

  const { Key } = await filesService.uploadFile(buffer, user.userId + '_' + fileName);

  const data = JSON.parse(f.data);

  const additionalRequests = data.additionalRequests || [];

  const request: AdditionalRequest = additionalRequests.find(r => r.id === requestId);

  if (!request) {
    throw new Error('Request not found');
  }

  request.status = 'answered';
  request.response = Key;

  await applicationsService.updateApplication(id, {
    status: request.request === contractUniqueMessage ? 'contract-signed' : data.status,
    data: JSON.stringify({
      ...data,
      additionalRequests: [...additionalRequests],
    })
  });

  return request;
}

export const updateRequestState = async (domain: string, id: number, requestId: string, status: AdditionalRequest['status']) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);

  const f = await applicationsService.getApplicationById(id);
  const data = JSON.parse(f.data);

  const additionalRequests = data.additionalRequests || [];

  const request: AdditionalRequest = additionalRequests.find(r => r.id === requestId);

  if (!request) {
    throw new Error('Request not found');
  }

  request.status = status;

  await applicationsService.updateApplication(id, {
    data: JSON.stringify({
      ...data,
      additionalRequests: [...additionalRequests],
    })
  })

  return request
}

export const updateApplicationStatus = async (domain: string, applicationId: number, status: 'approved' | 'rejected' | 'pending') => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);
  const emailsService = injector.resolve(EmailsService);

  const f = await applicationsService.getApplicationById(applicationId);

  await applicationsService.updateApplication(applicationId, {
    status,
  });

  const tenant = await getTenant();

  const userIds = await applicationsService.getAllApplicantsByApplicationId(applicationId);
  
  const users = await Promise.all(userIds.map(async (userId) => {
    return await getUser(userId);
  }));

  const user = users.shift();

  const approvedText = `
    <html>
      <body>
        <h1>Congratulations! Your Application Has Been Approved</h1>
        <p>Dear Valued Customer,</p>
        <p>We are pleased to inform you that your application to open an account with our bank has been approved. Welcome to our banking family!</p>
        <p>Here are the next steps:</p>
        <ol>
          <li>Visit your nearest branch with your identification documents</li>
          <li>Meet with one of our account specialists</li>
          <li>Complete the final paperwork</li>
          <li>Receive your new account details and banking materials</li>
        </ol>
        <p>If you have any questions, please don't hesitate to contact our customer service team.</p>
        <p>Thank you for choosing our bank. We look forward to serving you!</p>
      </body>
    </html>
  `;
  const rejectedText = `
    <html>
      <body>
        <h1>Application Status Update</h1>
        <p>Dear Applicant,</p>
        <p>We regret to inform you that your application to open an account with our bank has been unsuccessful at this time.</p>
        <p>Please note:</p>
        <ul>
          <li>This decision was based on the information provided in your application</li>
          <li>You may reapply after 90 days if your circumstances change</li>
          <li>You have the right to request more information about this decision</li>
        </ul>
        <p>If you would like to discuss this further or have any questions, please contact our customer service team.</p>
        <p>We appreciate your interest in our bank and wish you the best in your financial endeavors.</p>
      </body>
    </html>
  `;

  if (!['approved', 'rejected'].includes(status)) {
    return;
  }

  await emailsService.sendEmail(user.email, `your application to ${tenant.name} was ${status}`, '', status === 'approved' ? approvedText : rejectedText, users.map(u => u.email));
}

export const saveApplicationHeader = async (domain: string, application: Omit<Application, 'id'> | ({ id: Application['id'] } & Partial<Application>)) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);

  return 'id' in application ? applicationsService.updateApplication(application.id, application) : applicationsService.createApplication(application);
}

export const registerValidationFeatureResponse = async (domain: string, applicationId: number, featureId: string, data: object) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);

  return applicationsService.addValidationFeatureResponse(applicationId, featureId, data);
}

export const getValidationFeatureResponse = async (domain: string, applicationId: number, featureId: string) => {
  const injector = await getInjector(domain);
  const applicationsService = injector.resolve(ApplicationsService);

  return applicationsService.getValidationFeatureResponse(applicationId, featureId);

}

export const linkApplicant = async (domain: string, applicationId: number, email: string, purpose: string) => {
  const injector = await getInjector(domain);
  const invitationsService = injector.resolve(InvitationsService);

  await invitationsService.inviteApplicant(email, purpose, applicationId, domain);
}

export type Application = Awaited<ReturnType<typeof getApplicationsByUserId>>[0];
export type ApplicationWithUser = Awaited<ReturnType<typeof getAllApplications>>[0];
export type CreatedApplication = Awaited<ReturnType<typeof registerFormAnswers>>;
export type AdditionalRequest = {
  id?: string;
  type: string;
  request: string;
  status: 'pending' | 'viewed' | 'answered';
  response?: string;
}
