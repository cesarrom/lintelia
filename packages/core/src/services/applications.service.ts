import { and, eq } from "drizzle-orm";
import { applicants, applications, applicationValidationFeatures, invitations, userRoles } from "../models/platform.sql";
import { type PlatformDB } from "./tenants.service";
import { KYCService } from "./kyc.service";
import { env } from "../constants";
import { PLATFORM_DB_TOKEN } from "../libs/injector/tokens";
import { Autowire, Injectable } from "ts-injection";
import { FilesService } from "./files.service";
import { FormsService } from "./forms.service";
import * as cheerio from 'cheerio';
const { decisionTable } = require('@hbtgmbh/dmn-eval-js');
@Injectable()
export class ApplicationsService {
  @Autowire(KYCService)
  private kycService: KYCService;
  @Autowire(PLATFORM_DB_TOKEN)
  private db: PlatformDB;
  @Autowire(FilesService)
  private filesService: FilesService
  @Autowire(FormsService)
  private formsService: FormsService;

  async createApplication(applicationData: Partial<Omit<typeof applications.$inferSelect, 'status' | 'id'>>) {
    // const [
    //   selfieFileEntry,
    //   documentFrontFileEntry,
    //   documentBackFileEntry,
    // ] = await Promise.all([
    //   this.filesService.createFile({
    //     userId: applicationData.userId,
    //     name: `${applicationData.userId}_selfie.jpg`,
    //     file: selfie,
    //     mimeType: 'image/jpeg',
    //     size: selfie.length.toString(),
    //   }),
    //   this.filesService.createFile({
    //     userId: applicationData.userId,
    //     name: `${applicationData.userId}_document_front.jpg`,
    //     file: documentFront,
    //     mimeType: 'image/jpeg',
    //     size: documentFront.length.toString(),
    //   }),
    //   documentBack ? this.filesService.createFile({
    //     userId: applicationData.userId,
    //     name: `${applicationData.userId}_document_back.jpg`,
    //     file: documentBack,
    //     mimeType: 'image/jpeg',
    //     size: documentBack.length.toString(),
    //   }) : null
    // ] as const);

    const data = {
      ...applicationData,
      parentApplicationId: applicationData.parentApplicationId || null,
      status: 'in-progress',
    } as any;

    console.log('data', data);

    const app = await this.db.insert(applications).values(data).returning().execute();

    return app[0];
  }

  async addValidationFeatureResponse(applicationId: number, featureId: string, data: object) {
    const [res] = await this.db.insert(applicationValidationFeatures).values({
      applicationId,
      featureId,
      data: JSON.stringify(data),
    })
      .onConflictDoUpdate({
        target: [applicationValidationFeatures.applicationId, applicationValidationFeatures.featureId],
        set: {
          data: JSON.stringify(data),
        }
      })
      .returning().execute();

    return res;
  }

  async getValidationFeatureResponses(applicationId: number) {
    return await this.db.select().from(applicationValidationFeatures).where(eq(applicationValidationFeatures.applicationId, applicationId)).execute();
  }

  async getValidationFeatureResponse(applicationId: number, featureId: string) {
    const [f] = await this.db.select().from(applicationValidationFeatures).where(and(eq(applicationValidationFeatures.applicationId, applicationId), eq(applicationValidationFeatures.featureId, featureId))).execute();
    return f;
  }

  async verifyApplication(applicationId: number) {
    const application = await this.getApplicationById(applicationId);

    const applicationData = JSON.parse(application.data);

    const { selfie, documentFront, documentBack } = applicationData;

    const [selfieBuffer, documentFrontBuffer, documentBackBuffer] = await Promise.all([
      this.filesService.downloadFile(selfie),
      this.filesService.downloadFile(documentFront),
      documentBack ? this.filesService.downloadFile(documentBack) : null
    ]);

    const { applicant_id: applicantId } = await this.kycService.createApplicant({
      first_name: applicationData.data.firstName,
      last_name: applicationData.data.lastName,
      email: applicationData.data.email,
      'dob': applicationData.data.dob,
      'residence_country': applicationData.data.country,
      'type': 'PERSON'
    });

    if (!applicantId) {
      throw new Error("Failed to create applicant");
    }


    const { file_id: documentId } = await this.kycService.uploadFile(documentFrontBuffer, 'document.jpg');

    if (!documentId) {
      throw new Error("Failed to upload document");
    }

    const { file_id: documentBackId } = applicationData.documentBack ? await this.kycService.uploadFile(documentBackBuffer, 'document_back.jpg') : { file_id: undefined };

    if (applicationData.documentBack && !documentBackId) {
      throw new Error("Failed to upload document back");
    }

    const { file_id: selfieId } = await this.kycService.uploadFile(selfieBuffer, 'selfie.jpg');

    if (!selfieId) {
      throw new Error("Failed to upload selfie");
    }


    const { document_id: documentRef } = await this.kycService.createApplicantDocument({
      'applicant_id': applicantId,
      'front_side_id': documentId,
      'back_side_id': documentBackId,
      'document_number': applicationData.data.documentNumber,
      'issue_date': applicationData.data.documentIssueDate,
      'expiry_date': applicationData.data.documentExpiryDate,
      'type': applicationData.data.documentType,
    });

    if (!documentRef) {
      throw new Error("Failed to create applicant document");
    }

    const { document_id: selfieRef } = await this.kycService.createApplicantDocument({
      'applicant_id': applicantId,
      'front_side_id': selfieId,
      'type': 'SELFIE_IMAGE'
    });

    if (!selfieRef) {
      throw new Error("Failed to create applicant selfie");
    }

    const { verification_id: verificationId } = await this.kycService.createVerification({
      applicant_id: applicantId,
      form_id: env.KYC_WORKFLOW_ID,
    });

    if (!verificationId) {
      throw new Error("Failed to create verification");
    }

    const app = await this.updateApplication(applicationId, {
      status: 'pending',
    });

    return app;
  }

  async getApplicationById(id: number) {
    return await this.db
      .select()
      .from(applications)
      .where(eq(applications.id, id))
      .limit(1)
      .execute()
      .then((res) => res[0] || null);
  }

  async linkApplicant(applicationId: number, userId: string) {
    const [app] = await this.db
      .insert(applicants)
      .values({
        userId,
        applicationId,
      })
      .returning()
      .execute();

    return app;
  }

  async getAllApplicantsByApplicationId(applicationId: number) {
    return await this.db
      .select()
      .from(applicants)
      .where(eq(applicants.applicationId, applicationId))
      .execute()
      .then((res) => res.map(res => res.userId));
  }

  async getApplicationsByUserId(userId: string, parentApplicationId?: number) {
    return await this.db
      .select()
      .from(applications)
      .where(
        and(
          eq(applicants.userId, userId),
          eq(applications.parentApplicationId, parentApplicationId || null)
        )
      )
      .innerJoin(
        applicants,
        eq(applications.id, applicants.applicationId)
      )
      .execute()
      .then((res) => res.map(res => res.applications));
  }

  async updateApplication(id: number, applicationData: Partial<typeof applications.$inferSelect>) {
    const app = await this.db
      .update(applications)
      .set(applicationData)
      .where(eq(applications.id, id))
      .returning()
      .execute();

    return app[0];
  }

  async deleteApplication(id: number) {
    return await this.db.delete(applications).where(eq(applications.id, id)).returning().execute();
  }

  async getAllApplications(role?: string) {
    const a = await this.db.select().from(applications).where(
      eq(userRoles.role, role ? role : userRoles.role)
    )
      .innerJoin(
        applicants,
        eq(applications.id, applicants.applicationId)
      )
      .leftJoin(userRoles, eq(userRoles.userId, applicants.userId))
      .execute();

    return a
  }

  /**
 * Filters XML string by removing disallowed nodes.
 *
 * @param {string} xml - The XML string to be filtered.
 * @param {string[]} allowedNodes - An array of node names that should be retained.
 * @returns {string} - The resulting XML string with only allowed nodes.
 */
  private filterXmlNodes(xml: string, allowedNodes: string[]): string {
    // Load the XML with xmlMode enabled
    const $ = cheerio.load(xml, { xmlMode: true });

    // Select the <definitions> node
    const definitions = $('definitions');

    // Remove all direct children that are not in the allowedNodes list
    definitions.children().each((index, element) => {
      if (!allowedNodes.includes(element.tagName)) {
        $(element).remove();
      }
    });

    // Return the resulting XML string
    return $.xml().replace(/\<(\w+)/g, '<dmn:$1');
  }

  async evaluateRisk(applicationId: number, context: Record<string, any>): Promise<number> {
    try {
      const application = await this.getApplicationById(applicationId);

      if (!application) {
        throw new Error(`Application with id ${applicationId} not found`);
      }

      const form = await this.formsService.getFormById(application.formId);


      if (!form) {
        throw new Error(`Form with id ${application.formId} not found`);
      }

      const xmlContent = await this.filesService
        .downloadFile(form.dmnKey)
        .then(content => this.filterXmlNodes(content.toString('utf-8'), ['decision', 'inputData', 'input', 'output'])); // readFileSync(join(process.cwd(), 'personal_risk_assessment.dmn'), 'utf8');

      const decisions = await decisionTable.parseDmnXml(xmlContent);

      const risk = await (async () => {
        const { risk } = decisionTable.evaluateDecision('Decision_risk', decisions, JSON.parse(application.data))

        if (!risk) {
          throw new Error("Failed to evaluate risk");
        }

        return { risk };
      })()
        .catch(e => {
          return decisionTable.evaluateDecision('Decision_risk', decisions,
            {
              age: 22,
              country: 'Bouvet Island',
              employment: 'Accounts clerk',
              transactionsVolume: 2,
              expectedActivityValue: 550_000,
              product: 3,
              isPep: false,
              isSanctionOrTerrorist: false,
              isSubjectToCriminalInvestigation: false,
              isConvictionStremming: false,
              documentType: 'PASSPORT'
            });
        })
        .then(({ risk }) => {
          console.log('response', { risk });
          return risk;
        })

      if (risk === undefined) {
        throw new Error("Failed to evaluate risk");
      }

      const RISK_MAP = {
        1: 'Low',
        2: 'Medium',
        3: 'High',
        5: 'Very High',
      }

      return RISK_MAP[risk]
    } catch (e) {
      console.error(e);
      return 'Unknown' as any;
    }
  }


}